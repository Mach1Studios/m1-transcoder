#include "PluginProcessor.h"
#include "PluginEditor.h"

juce::String M1TranscoderAudioProcessor::paramInputMode("inputMode");
juce::String M1TranscoderAudioProcessor::paramOutputMode("outputMode");
juce::String M1TranscoderAudioProcessor::paramShowExactInputChannels("showExactInputChannels");
juce::String M1TranscoderAudioProcessor::paramShowExactOutputChannels("showExactOutputChannels");

//==============================================================================
M1TranscoderAudioProcessor::M1TranscoderAudioProcessor()
     : m_decode_strategy(&M1TranscoderAudioProcessor::nullStrategy),
       m_transcode_strategy(&M1TranscoderAudioProcessor::nullStrategy),
       AudioProcessor(getHostSpecificLayout()),
       parameters(*this, &mUndoManager, juce::Identifier("M1-Transcoder"), {
    std::make_unique<juce::AudioParameterInt>(juce::ParameterID(paramInputMode, 1), TRANS("Input Mode"), 0, 128, 0),
    std::make_unique<juce::AudioParameterInt>(juce::ParameterID(paramOutputMode, 1), TRANS("Output Mode"), 0, 128, 0),
    std::make_unique<juce::AudioParameterBool>(juce::ParameterID(paramShowExactInputChannels, 1), TRANS("Show Exact Input Channels"), true),
    std::make_unique<juce::AudioParameterBool>(juce::ParameterID(paramShowExactOutputChannels, 1), TRANS("Show Exact Output Channels"), true)
       })
{
    parameters.addParameterListener(paramInputMode, this);
    parameters.addParameterListener(paramOutputMode, this);
    parameters.addParameterListener(paramShowExactInputChannels, this);
    parameters.addParameterListener(paramShowExactOutputChannels, this);
    pendingFormatChange = true;
    inputChannelLevels.resize(8, 0.0f);
    outputChannelLevels.resize(8, 0.0f);
    inputChannelMutes.resize(8, false);
    outputChannelMutes.resize(8, false);
    juce::String date(__DATE__);
    juce::String time(__TIME__);
}

M1TranscoderAudioProcessor::~M1TranscoderAudioProcessor()
{
}

//==============================================================================
const juce::String M1TranscoderAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool M1TranscoderAudioProcessor::acceptsMidi() const
{
   #if JucePlugin_WantsMidiInput
    return true;
   #else
    return false;
   #endif
}

bool M1TranscoderAudioProcessor::producesMidi() const
{
   #if JucePlugin_ProducesMidiOutput
    return true;
   #else
    return false;
   #endif
}

bool M1TranscoderAudioProcessor::isMidiEffect() const
{
   #if JucePlugin_IsMidiEffect
    return true;
   #else
    return false;
   #endif
}

double M1TranscoderAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int M1TranscoderAudioProcessor::getNumPrograms()
{
    return 1;   // NB: some hosts don't cope very well if you tell them there are 0 programs,
                // so this should be at least 1, even if you're not really implementing programs.
}

int M1TranscoderAudioProcessor::getCurrentProgram()
{
    return 0;
}

void M1TranscoderAudioProcessor::setCurrentProgram (int index)
{
}

const juce::String M1TranscoderAudioProcessor::getProgramName (int index)
{
    return {};
}

void M1TranscoderAudioProcessor::changeProgramName (int index, const juce::String& newName)
{
}

//==============================================================================
void M1TranscoderAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    // Setup for Mach1Decode
    smoothedChannelCoeffs.resize(m1Decode.getFormatCoeffCount());
    spatialMixerCoeffs.resize(m1Decode.getFormatCoeffCount());
    for (int input_channel = 0; input_channel < m1Decode.getFormatChannelCount(); input_channel++) {
        smoothedChannelCoeffs[input_channel * 2 + 0].reset(sampleRate, (double) 0.01);
        smoothedChannelCoeffs[input_channel * 2 + 1].reset(sampleRate, (double) 0.01);
    }
    
    // restructure output buffer
    readBuffer.setSize(m1Decode.getFormatCoeffCount(), samplesPerBlock);
    
    pendingFormatChange = true;
    reconfigureAudioTranscode();
}

void M1TranscoderAudioProcessor::fallbackDecodeStrategy(const AudioSourceChannelInfo &bufferToFill) {
    // Invalid Decode I/O; clear buffers
    for (auto channel = getTotalNumInputChannels(); channel < 2; ++channel) {
        if (channel < bufferToFill.buffer->getNumChannels())
        {
            bufferToFill.buffer->clear(channel, 0, bufferToFill.numSamples);
        }
    }
}

void M1TranscoderAudioProcessor::intermediaryBufferDecodeStrategy(const AudioSourceChannelInfo &bufferToFill) {    
    auto sample_count = bufferToFill.numSamples;
    auto channel_count = getTotalNumInputChannels();
    float *outBufferR = nullptr;
    float *outBufferL = bufferToFill.buffer->getWritePointer(0);
    if (bufferToFill.buffer->getNumChannels() > 1)
    {
        outBufferR = bufferToFill.buffer->getWritePointer(1);
    }
    //auto ori_deg = currentOrientation.GetGlobalRotationAsEulerDegrees();
    //m1Decode.setRotationDegrees({ori_deg.GetYaw(), ori_deg.GetPitch(), ori_deg.GetRoll()});
    spatialMixerCoeffs = m1Decode.decodeCoeffs();

    // Update spatial mixer coeffs from Mach1Decode for a smoothed value
    for (int channel = 0; channel < channel_count; ++channel) {
        smoothedChannelCoeffs[channel * 2 + 0].setTargetValue(spatialMixerCoeffs[channel * 2 + 0]);
        smoothedChannelCoeffs[channel * 2 + 1].setTargetValue(spatialMixerCoeffs[channel * 2 + 1]);
    }

    // copy from intermediaryBuffer for doubled channels
    for (auto channel = 0; channel < channel_count; ++channel) {
        tempBuffer.copyFrom(channel * 2 + 0, 0, intermediaryBuffer, channel, 0, sample_count);
        tempBuffer.copyFrom(channel * 2 + 1, 0, intermediaryBuffer, channel, 0, sample_count);
    }

    // apply decode coeffs to output buffer
    for (int sample = 0; sample < bufferToFill.numSamples; sample++) {
        for (int channel = 0; channel < channel_count; channel++) {
            auto left_sample = tempBuffer.getReadPointer(channel * 2 + 0)[sample];
            auto right_sample = tempBuffer.getReadPointer(channel * 2 + 1)[sample];
            outBufferL[sample] += left_sample * smoothedChannelCoeffs[channel * 2 + 0].getNextValue();
            if (bufferToFill.buffer->getNumChannels() > 1)
            {
                outBufferR[sample] += right_sample * smoothedChannelCoeffs[channel * 2 + 1].getNextValue();
            }
        }
    }
}

void M1TranscoderAudioProcessor::intermediaryBufferTranscodeStrategy(const AudioSourceChannelInfo &bufferToFill) {
    if (!bufferToFill.buffer || bufferToFill.numSamples <= 0) {
        return;
    }

    static int inChannels = 0;
    static int outChannels = 0;
    
    static bool needChannelUpdate = true;
    static std::string lastInputFormat = "";
    static std::string lastOutputFormat = "";
    
    // Check if formats have changed
    if (lastInputFormat != selectedInputFormatName || lastOutputFormat != selectedOutputFormatName || needChannelUpdate) {
        try {
            inChannels = m1Transcode.getInputNumChannels();
            outChannels = m1Transcode.getOutputNumChannels();
            lastInputFormat = selectedInputFormatName;
            lastOutputFormat = selectedOutputFormatName;
            needChannelUpdate = false;
        } catch (...) {
            for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel) {
                bufferToFill.buffer->clear(channel, bufferToFill.startSample, bufferToFill.numSamples);
            }
            pendingFormatChange = true;
            return;
        }
    }

    // Validate basic requirements for processing
    if (inChannels <= 0 || outChannels <= 0 || bufferToFill.numSamples > 16384) {
        for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel) {
            bufferToFill.buffer->clear(channel, bufferToFill.startSample, bufferToFill.numSamples);
        }
        pendingFormatChange = true;
        return;
    }

    auto sampleCount = bufferToFill.numSamples;
    
    // Only resize output buffer when needed
    if (intermediaryBuffer.getNumChannels() != outChannels || intermediaryBuffer.getNumSamples() < sampleCount) {
        try {
            intermediaryBuffer.setSize(outChannels, sampleCount, false, true, true);
        } catch (...) {
            for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel) {
                bufferToFill.buffer->clear(channel, bufferToFill.startSample, bufferToFill.numSamples);
            }
            return;
        }
    }

    // Clear the output buffer before processing
    intermediaryBuffer.clear();

    static std::vector<float*> readPtrs;
    static std::vector<float*> intermediaryPtrs;
    static float silentBuffer[16384] = {0};
    
    if (readPtrs.size() < static_cast<size_t>(inChannels)) 
        readPtrs.resize(inChannels, nullptr);
    
    if (intermediaryPtrs.size() < static_cast<size_t>(outChannels))
        intermediaryPtrs.resize(outChannels, nullptr);
    
    for (int i = 0; i < inChannels; i++) {
        readPtrs[i] = (i < readBuffer.getNumChannels()) ? 
            readBuffer.getWritePointer(i) : silentBuffer;
    }

    for (int i = 0; i < outChannels; i++) {
        intermediaryPtrs[i] = intermediaryBuffer.getWritePointer(i);
    }

    bool conversionSucceeded = safeProcessConversion(readPtrs.data(), intermediaryPtrs.data(), sampleCount);

    if (conversionSucceeded) {
        const int numOutputs = juce::jmin(bufferToFill.buffer->getNumChannels(), intermediaryBuffer.getNumChannels());
        for (int channel = 0; channel < numOutputs; ++channel) {
            bufferToFill.buffer->copyFrom(channel, bufferToFill.startSample, 
                                         intermediaryBuffer.getReadPointer(channel), 
                                         bufferToFill.numSamples);
        }
    } else {
        // If conversion failed, output silence
        for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel) {
            bufferToFill.buffer->clear(channel, bufferToFill.startSample, bufferToFill.numSamples);
        }
        
        pendingFormatChange = true;
        needChannelUpdate = true;
    }
}

void M1TranscoderAudioProcessor::nullStrategy(const AudioSourceChannelInfo &bufferToFill)
{
    static int nullCallCount = 0;
    static int lastErrorTime = 0;
    
    // Clear output buffer immediately to prevent noise
    for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel) {
        bufferToFill.buffer->clear(channel, bufferToFill.startSample, bufferToFill.numSamples);
    }
    
    const int currentTime = juce::Time::getMillisecondCounter();
    if (nullCallCount++ % 200 == 0 && (currentTime - lastErrorTime > 5000)) {
        DBG("[ERROR] nullStrategy called - No valid audio strategy available");
        DBG("[DEBUG] Channel counts - Inputs: " + juce::String(getTotalNumInputChannels()) + " Outputs: " + juce::String(getTotalNumOutputChannels()));
        
        Mach1::AlertData data { "OUTPUT ERROR", "No valid audio strategy available. Trying to recover...", "OK" };
        postAlert(data);
        
        lastErrorTime = currentTime;
        
        // Try to recover by forcing reconfiguration
        pendingFormatChange = true;
        reconfigureAudioTranscode();
    }
}

void M1TranscoderAudioProcessor::releaseResources()
{
    // When playback stops, you can use this as an opportunity to free up any
    // spare memory, etc.
}

bool M1TranscoderAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    auto numIns  = layouts.getMainInputChannels();
    //auto numOuts = layouts.getMainOutputChannels();

    // allow any configuration where there are at least 2 channels
    return (numIns >= 2);
}

void M1TranscoderAudioProcessor::parameterChanged(const juce::String& parameterID, float newValue)
{
    if (parameterID == paramInputMode)
    {
        int index = static_cast<int>(newValue);
        auto availableInputFormats = getMatchingInputFormatNames(getTotalNumInputChannels());

        // Ensure index is valid for the current list
        if (index >= 0 && index < static_cast<int>(availableInputFormats.size()))
        {
            // Get the name corresponding to the selected index and set it
            setTranscodeInputFormat(availableInputFormats[index]);
        }
    }
    else if (parameterID == paramOutputMode)
    {
        int index = static_cast<int>(newValue);
        // Get available formats based on current output filter
        auto availableOutputFormats = getMatchingOutputFormatNames(getTotalNumOutputChannels());

        if (index >= 0 && index < static_cast<int>(availableOutputFormats.size()))
        {
            auto compatibleOutputs = getCompatibleOutputFormats(selectedInputFormatName, getTotalNumOutputChannels());
            if (std::find(compatibleOutputs.begin(), compatibleOutputs.end(), availableOutputFormats[index]) != compatibleOutputs.end()) 
            {   
                 // Get the name corresponding to the selected index and set it
                setTranscodeOutputFormat(availableOutputFormats[index]);
            } else {
                Mach1::AlertData data { "Incompatible Selection", "Selected output format is not compatible.", "OK" };
                postAlert(data);
            }
        }
    }
    else if (parameterID == paramShowExactInputChannels)
    {
        // Input filter mode changed, trigger UI update
        pendingFormatChange = true; 
    }
    else if (parameterID == paramShowExactOutputChannels)
    {
        // Output filter mode changed, trigger UI update
        pendingFormatChange = true;
    }
}


void M1TranscoderAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();
    static int lastInputChannels = 0;
    static int lastOutputChannels = 0;

    if ((totalNumInputChannels != lastInputChannels && abs(totalNumInputChannels - lastInputChannels) > 1) || 
        (totalNumOutputChannels != lastOutputChannels && abs(totalNumOutputChannels - lastOutputChannels) > 1)) {
        lastInputChannels = totalNumInputChannels;
        lastOutputChannels = totalNumOutputChannels;
        pendingFormatChange = true;
    }
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        if (ch < inputChannelMutes.size() && inputChannelMutes[ch]) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }

    // Copy input to readBuffer for processing
    if (totalNumInputChannels > 0 && totalNumOutputChannels > 0) {
        // Only resize buffers if needed
        if (readBuffer.getNumChannels() != totalNumInputChannels || 
            readBuffer.getNumSamples() != buffer.getNumSamples()) {
            try {
                readBuffer.setSize(totalNumInputChannels, buffer.getNumSamples(), false, true, true);
                tempBuffer.setSize(totalNumOutputChannels * 2, buffer.getNumSamples(), false, true, true);
            }
            catch (...) {
                return;
            }
        }

        // Copy input to readBuffer for processing
        readBuffer.clear();
        for (int channel = 0; channel < totalNumInputChannels && channel < buffer.getNumChannels(); ++channel) {
            readBuffer.copyFrom(channel, 0, buffer, channel, 0, buffer.getNumSamples());
        }
        
        // Try to process with transcoder
        static bool needsConfigUpdate = false;
        static std::string lastInputFormat;
        static std::string lastOutputFormat;
        
        if (lastInputFormat != selectedInputFormatName || lastOutputFormat != selectedOutputFormatName) {
            lastInputFormat = selectedInputFormatName;
            lastOutputFormat = selectedOutputFormatName;
            needsConfigUpdate = true;
        }
        
        bool processed = false;
        
        // Only try processing if we're not reconfiguring
        if (!pendingFormatChange && !needsConfigUpdate && selectedInputFormatName.length() > 0 && selectedOutputFormatName.length() > 0) {
            std::vector<float*> readPtrs(totalNumInputChannels, nullptr);
            std::vector<float*> outputPtrs(totalNumOutputChannels, nullptr);
            
            for (int i = 0; i < totalNumInputChannels; i++) {
                readPtrs[i] = readBuffer.getWritePointer(i);
            }
            
            for (int i = 0; i < totalNumOutputChannels && i < buffer.getNumChannels(); i++) {
                outputPtrs[i] = buffer.getWritePointer(i);
            }
            
            // Try direct conversion
            try {
                // Make sure valid conversion path
                if (m1Transcode.processConversionPath()) {
                    m1Transcode.processConversion(readPtrs.data(), outputPtrs.data(), buffer.getNumSamples());
                    processed = true;
                }
            }
            catch (...) {
                // If direct processing fails,fall back to passthrough
                processed = false;
            }
        }
        
        // If processing failed or is not available, just copy input to output
        if (!processed) {
            // Passthrough - copy input channels to output
            for (int channel = 0; channel < buffer.getNumChannels(); ++channel) {
                if (channel >= totalNumInputChannels) {
                    buffer.clear(channel, 0, buffer.getNumSamples());
                }
                else if (channel < readBuffer.getNumChannels()) {
                    buffer.copyFrom(channel, 0, readBuffer, channel, 0, buffer.getNumSamples());
                }
            }
        }
    }
    
    static int levelCounter = 0;
    if ((levelCounter++ % 4) == 0 && buffer.getNumChannels() > 0) {
        if (inputChannelLevels.size() < buffer.getNumChannels())
            inputChannelLevels.resize(buffer.getNumChannels(), 0.0f);
            
        for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
            float level = 0.0f;
            const float* channelData = buffer.getReadPointer(ch);
            for (int i = 0; i < buffer.getNumSamples(); i += 8) { // Only sample every 8th sample
                level = std::max(level, std::abs(channelData[i]));
            }
            inputChannelLevels[ch] = 0.7f * inputChannelLevels[ch] + 0.3f * level;
        }
        
        if (outputChannelLevels.size() < buffer.getNumChannels())
            outputChannelLevels.resize(buffer.getNumChannels(), 0.0f);
            
        for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
            float level = 0.0f;
            const float* channelData = buffer.getReadPointer(ch);
            for (int i = 0; i < buffer.getNumSamples(); i += 8) { // Only sample every 8th sample
                level = std::max(level, std::abs(channelData[i]));
            }
            outputChannelLevels[ch] = 0.7f * outputChannelLevels[ch] + 0.3f * level;
        }
    }

    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        if (ch < outputChannelMutes.size() && outputChannelMutes[ch]) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }
    
    static int formatUpdateCounter = 0;
    if (pendingFormatChange && formatUpdateCounter++ > 100) {
        formatUpdateCounter = 0;
        
        reconfigureAudioTranscode();
        pendingFormatChange = false;
    }
}

std::string M1TranscoderAudioProcessor::getTranscodeInputFormat() const {
    return selectedInputFormatName;
}

std::string M1TranscoderAudioProcessor::getTranscodeOutputFormat() const {
    return selectedOutputFormatName;
}

void M1TranscoderAudioProcessor::setTranscodeInputFormat(const std::string &name) {
    if (!name.empty() && m1Transcode.getFormatFromString(name) != -1) {
        if (selectedInputFormatName != name) { // Only update if changed
             selectedInputFormatName = name;
             // Set the format in the actual transcoder
             m1Transcode.setInputFormat(m1Transcode.getFormatFromString(name));
             pendingFormatChange = true; 
        }
    }
}

void M1TranscoderAudioProcessor::setTranscodeOutputFormat(const std::string &name) {
    if (!name.empty() && m1Transcode.getFormatFromString(name) != -1) {
        if (selectedOutputFormatName != name) {
            selectedOutputFormatName = name;
            // Set the format in the actual transcoder
            m1Transcode.setOutputFormat(m1Transcode.getFormatFromString(name));
            pendingFormatChange = true; 
        }
    }
}

void M1TranscoderAudioProcessor::reconfigureAudioDecode() {
    // Setup for Mach1Decode API
    m1Decode.setPlatformType(Mach1PlatformType::Mach1PlatformDefault);
    m1Decode.setFilterSpeed(0.99f);

    switch (getTotalNumInputChannels()) {
        case 0:
            m_decode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
            break;
        default:
            m_decode_strategy = &M1TranscoderAudioProcessor::intermediaryBufferDecodeStrategy; // decode to intermediary buffer for transcoding
            break;
    }
}

// TODO: Detect any Mach1Spatial comment metadata
void M1TranscoderAudioProcessor::reconfigureAudioTranscode() {
    DBG("[DEBUG] Reconfiguring audio transcode");
    
    m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;

    int inputChannels = getTotalNumInputChannels();
    int outputChannels = getTotalNumOutputChannels();
    
    if (inputChannels < 1 || outputChannels < 1) {
        DBG("[DEBUG] Reconfig: Bailing due to zero channels.");
        return;
    }

    bool inputFormatWasReset = false;
    bool outputFormatWasReset = false;
    
    bool inputFormatInvalid = selectedInputFormatName.empty() || 
                             m1Transcode.getFormatFromString(selectedInputFormatName) == -1;
    bool inputChannelMismatch = false;
    if (!inputFormatInvalid) {
        try {
            bool exactMatchRequired = parameters.getParameterAsValue(paramShowExactInputChannels).getValue();
            int selectedFormatChannels = m1Transcode.getInputNumChannels(); // Get channels for the currently selected format
            
            if (exactMatchRequired && (selectedFormatChannels != inputChannels)) {
                inputChannelMismatch = true;
            } 

        } catch (...) {
             inputFormatInvalid = true; // Treat exception during check as invalid
        }
    }
    
    if (inputFormatInvalid || inputChannelMismatch) {
        
        std::string newFormat = getDefaultFormatForChannelCount(inputChannels);
        if (newFormat.empty()) {
             auto availableFormats = getMatchingInputFormatNames(inputChannels);
             if (!availableFormats.empty()) {
                 newFormat = availableFormats[0];
             } else {
                 return;
             }
        }
        setTranscodeInputFormat(newFormat); // This sets the name and pendingFormatChange
        inputFormatWasReset = true;
    }
    
    bool outputNeedsReset = false;
    if (selectedOutputFormatName.empty() || m1Transcode.getFormatFromString(selectedOutputFormatName) == -1) {
        outputNeedsReset = true;
    } else if (inputFormatWasReset) {
        outputNeedsReset = true;
    } else {
        try {
             m1Transcode.setInputFormat(m1Transcode.getFormatFromString(selectedInputFormatName));
             m1Transcode.setOutputFormat(m1Transcode.getFormatFromString(selectedOutputFormatName));
             if (!m1Transcode.processConversionPath()) {
                 outputNeedsReset = true;
             }
         } catch (...) {
             outputNeedsReset = true;
         }
    }

    if (outputNeedsReset) {
        // Find the best compatible output based on current input and host output channels + filter
        auto compatibleOutputs = getCompatibleOutputFormats(selectedInputFormatName, outputChannels);
        
        if (!compatibleOutputs.empty()) {
            setTranscodeOutputFormat(compatibleOutputs[0]);
            outputFormatWasReset = true;
        } else {
             setTranscodeOutputFormat(""); // Clear the output format
             outputFormatWasReset = true;
        }
    }

    if (selectedInputFormatName.empty() || selectedOutputFormatName.empty()) {
         m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
         pendingFormatChange = false;
         return;
    }

    try {
        m1Transcode.setInputFormat(m1Transcode.getFormatFromString(selectedInputFormatName));
        m1Transcode.setOutputFormat(m1Transcode.getFormatFromString(selectedOutputFormatName));
    } catch (...) {
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        pendingFormatChange = false;
        return;
    }
    
    // Check path validity one last time before setting strategy
    bool conversionPathValid = m1Transcode.processConversionPath();
    
    if (conversionPathValid) {
        try {
            // Verify actual channel counts match host after setting formats
            int actualInputChannels = m1Transcode.getInputNumChannels();
            int actualOutputChannels = m1Transcode.getOutputNumChannels();
            
            if (actualInputChannels == inputChannels && actualOutputChannels == outputChannels) {
                DBG("[DEBUG] Reconfig: Setting intermediaryBufferTranscodeStrategy.");
                m_transcode_strategy = &M1TranscoderAudioProcessor::intermediaryBufferTranscodeStrategy;
                
                // If formats were reset, update the UI parameters to reflect the change
                if (inputFormatWasReset || outputFormatWasReset) {
                    DBG("[DEBUG] Reconfig: Updating UI parameters due to reset.");
                }
            } else {
                 DBG(juce::String("[WARNING] Reconfig: Transcoder channel counts (") + juce::String(actualInputChannels) + "," + juce::String(actualOutputChannels) + ") don't match host (" + juce::String(inputChannels) + "," + juce::String(outputChannels) + ") after config. Using null strategy."); 
                 m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
            }
        } catch (...) {
            DBG("[ERROR] Reconfig: Exception while getting channel counts/setting strategy.");
            m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        }
    } else {
         DBG("[WARNING] Reconfig: Final conversion path invalid. Using null strategy.");
         m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
    }
    
    DBG("[DEBUG] Reconfig finished.");
    pendingFormatChange = false; // Configuration attempt complete
}

//==============================================================================
bool M1TranscoderAudioProcessor::hasEditor() const
{
    return true; // (change this to false if you choose to not supply an editor)
}

juce::AudioProcessorEditor* M1TranscoderAudioProcessor::createEditor()
{
    auto* editor = new M1TranscoderAudioProcessorEditor(*this);

    // When the processor sees a new alert, tell the editor to display it
    postAlertToUI = [editor](const Mach1::AlertData& a)
    {
        editor->mainComponent->postAlert(a);
    };
    
    return editor;
}

//==============================================================================
void M1TranscoderAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    // Let the ValueTree handle it
    auto state = parameters.copyState();
    
    // Add our custom properties
    state.setProperty("selectedInputFormatIndex", selectedInputFormatIndex, nullptr);
    state.setProperty("selectedOutputFormatIndex", selectedOutputFormatIndex, nullptr);
    state.setProperty("selectedInputFormatName", juce::String(selectedInputFormatName), nullptr); // Save name
    state.setProperty("selectedOutputFormatName", juce::String(selectedOutputFormatName), nullptr); // Save name
    // Bool parameters (paramShowExact...) are saved automatically by ValueTreeState
    
    if (auto xml = state.createXml())
        copyXmlToBinary(*xml, destData);
}

void M1TranscoderAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    // Let the ValueTree handle it
    if (auto xml = getXmlFromBinary(data, sizeInBytes))
    {
        auto state = juce::ValueTree::fromXml(*xml);
        parameters.replaceState(state);
        
        // Restore our custom properties
        selectedInputFormatIndex = state.getProperty("selectedInputFormatIndex", 0);
        selectedOutputFormatIndex = state.getProperty("selectedOutputFormatIndex", 0);
        selectedInputFormatName = state.getProperty("selectedInputFormatName", "").toString().toStdString();
        selectedOutputFormatName = state.getProperty("selectedOutputFormatName", "").toString().toStdString();
        
        // Set the restored formats in the transcoder instance
        if (!selectedInputFormatName.empty()) {
            m1Transcode.setInputFormat(m1Transcode.getFormatFromString(selectedInputFormatName));
        }
        if (!selectedOutputFormatName.empty()) {
             m1Transcode.setOutputFormat(m1Transcode.getFormatFromString(selectedOutputFormatName));
        }
        
        // Trigger a UI update and potentially reconfigure based on restored state
        pendingFormatChange = true; 
    }
}

//==============================================================================
// This creates new instances of the plugin..
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new M1TranscoderAudioProcessor();
}

bool M1TranscoderAudioProcessor::safeProcessConversion(float** inBufs, float** outBufs, int numSamples) {

    const juce::SpinLock::ScopedTryLockType lock(transcodeProcessLock);
    
    if (!lock.isLocked()) {
        // We couldn't get the lock, so skip this buffer to avoid stuttering
        return false;
    }
    if (!inBufs || !outBufs || numSamples <= 0) {
        return false;
    }
    int inChannels = m1Transcode.getInputNumChannels();
    int outChannels = m1Transcode.getOutputNumChannels();
    
    if (inChannels <= 0 || outChannels <= 0) {
        return false;
    }
    for (int i = 0; i < inChannels; i++) {
        if (!inBufs[i]) return false;
    }
    
    for (int i = 0; i < outChannels; i++) {
        if (!outBufs[i]) return false;
    }
    
    // Verify that the conversion path is valid - cache this result
    static bool lastPathValid = false;
    static std::string lastInputFormat;
    static std::string lastOutputFormat;
    
    // Only check the path if the formats have changed
    if (lastInputFormat != selectedInputFormatName || lastOutputFormat != selectedOutputFormatName) {
        lastPathValid = m1Transcode.processConversionPath();
        lastInputFormat = selectedInputFormatName;
        lastOutputFormat = selectedOutputFormatName;
    }
    
    if (!lastPathValid) {
        return false;
    }
    try {
        m1Transcode.processConversion(inBufs, outBufs, numSamples);
        return true;
    } catch (...) {
        return false;
    }
}

void M1TranscoderAudioProcessor::postAlert(const Mach1::AlertData& alert)
{
    if (postAlertToUI) {
        postAlertToUI(alert);
    } else {
        pendingAlerts.push_back(alert); // Store for later
        DBG("Stored alert for UI. Total pending: " + juce::String(pendingAlerts.size()));
    }
}
