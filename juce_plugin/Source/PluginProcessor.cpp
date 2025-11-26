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
    // Setup for Mach1Decode (used for decode strategy, not currently active)
    smoothedChannelCoeffs.resize(m1Decode.getFormatCoeffCount());
    spatialMixerCoeffs.resize(m1Decode.getFormatCoeffCount());
    for (int input_channel = 0; input_channel < m1Decode.getFormatChannelCount(); input_channel++) {
        smoothedChannelCoeffs[input_channel * 2 + 0].reset(sampleRate, (double) 0.01);
        smoothedChannelCoeffs[input_channel * 2 + 1].reset(sampleRate, (double) 0.01);
    }
    
    // Prepare buffers for transcoding
    // Allocate for maximum possible channels (64) to be safe, or at least enough for current layout
    // We'll use 64 as a safe upper bound for Mach1 formats
    int maxChannels = 64; 
    
    m_inputPointers.resize(maxChannels, nullptr);
    m_outputPointers.resize(maxChannels, nullptr);
    
    int numInputChannels = getTotalNumInputChannels();
    int numOutputChannels = getTotalNumOutputChannels();
    
    // Ensure buffers are large enough
    readBuffer.setSize(juce::jmax(numInputChannels, 8), samplesPerBlock);
    intermediaryBuffer.setSize(juce::jmax(numOutputChannels, 8), samplesPerBlock);
    tempBuffer.setSize(juce::jmax(numOutputChannels, 8) * 2, samplesPerBlock);
    
    // Configure transcoding
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
        // Input filter mode changed, trigger reconfiguration
        reconfigureAudioTranscode();
    }
    else if (parameterID == paramShowExactOutputChannels)
    {
        // Output filter mode changed, trigger reconfiguration
        reconfigureAudioTranscode();
    }
}


void M1TranscoderAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();
    
    // Handle pending format changes or channel count changes
    if (pendingFormatChange) {
        // Try to reconfigure if enough time has passed or just skip
        // For now, just clear buffer and return to avoid noise
        buffer.clear();
        
        // We can try to reconfigure here if it's cheap, but better to do it in a timer or parameter callback
        // The original code did it here with a counter. We'll stick to the timer approach or just wait.
        // But we need to ensure reconfigureAudioTranscode is called eventually.
        // For this implementation, we assume reconfigureAudioTranscode is called by parameterChanged.
        // If we need to trigger it from here, we should use a flag that the editor/timer checks.
        
        // However, to maintain behavior:
        static int formatUpdateCounter = 0;
        if (formatUpdateCounter++ > 100) {
            formatUpdateCounter = 0;
            reconfigureAudioTranscode();
            pendingFormatChange = false;
        }
        return;
    }

    // Apply input channel mutes
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        if (ch < inputChannelMutes.size() && inputChannelMutes[ch]) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }

    // Main transcoding logic
    bool processed = false;
    
    // Check if we have valid formats and conversion path
    if (totalNumInputChannels > 0 && totalNumOutputChannels > 0 && 
        !selectedInputFormatName.empty() && !selectedOutputFormatName.empty() && m_conversionValid) {
            
        // Try to acquire lock - if busy, skip processing (stutter is better than block/crash, but silence is better than stutter)
        const juce::SpinLock::ScopedTryLockType lock(transcodeProcessLock);
        
        if (lock.isLocked()) {
            int expectedInputChannels = m1Transcode.getInputNumChannels();
            int expectedOutputChannels = m1Transcode.getOutputNumChannels();
            
            if (expectedInputChannels == totalNumInputChannels && 
                expectedOutputChannels == totalNumOutputChannels) {
                
                // 1. Prepare Input
                // Check if readBuffer needs resizing (shouldn't if prepareToPlay was called correctly)
                if (readBuffer.getNumChannels() < totalNumInputChannels || readBuffer.getNumSamples() < buffer.getNumSamples()) {
                    // This shouldn't happen if prepareToPlay is correct, but safety first
                    // We can't resize here safely. Just bail.
                } else {
                    // Copy input to readBuffer and clear unused channels
                    for (int ch = 0; ch < totalNumInputChannels; ch++) {
                        if (ch < buffer.getNumChannels()) {
                            readBuffer.copyFrom(ch, 0, buffer, ch, 0, buffer.getNumSamples());
                        } else {
                            readBuffer.clear(ch, 0, buffer.getNumSamples());
                        }
                    }
                    
                    // Setup input pointers
                    if (m_inputPointers.size() >= totalNumInputChannels) {
                        for (int i = 0; i < totalNumInputChannels; i++) {
                            m_inputPointers[i] = readBuffer.getWritePointer(i);
                        }
                        
                        // 2. Prepare Output
                        float** outPtrs = nullptr;
                        bool useIntermediary = false;
                        
                        if (buffer.getNumChannels() >= totalNumOutputChannels) {
                            // Direct output
                            if (m_outputPointers.size() >= totalNumOutputChannels) {
                                for (int i = 0; i < totalNumOutputChannels; i++) {
                                    m_outputPointers[i] = buffer.getWritePointer(i);
                                }
                                outPtrs = m_outputPointers.data();
                            }
                        } else {
                            // Use intermediary
                            useIntermediary = true;
                            if (intermediaryBuffer.getNumChannels() >= totalNumOutputChannels && 
                                intermediaryBuffer.getNumSamples() >= buffer.getNumSamples()) {
                                
                                if (m_outputPointers.size() >= totalNumOutputChannels) {
                                    for (int i = 0; i < totalNumOutputChannels; i++) {
                                        m_outputPointers[i] = intermediaryBuffer.getWritePointer(i);
                                    }
                                    outPtrs = m_outputPointers.data();
                                    
                                    // Clear intermediary
                                    for(int i=0; i<totalNumOutputChannels; ++i)
                                        intermediaryBuffer.clear(i, 0, buffer.getNumSamples());
                                }
                            }
                        }
                        
                        // 3. Process
                        if (outPtrs) {
                            // Clear output buffer if direct (intermediary already cleared)
                            if (!useIntermediary) {
                                for(int i=0; i<totalNumOutputChannels; ++i)
                                    buffer.clear(i, 0, buffer.getNumSamples());
                            }
                            
                            try {
                                m1Transcode.processConversion(m_inputPointers.data(), outPtrs, buffer.getNumSamples());
                                processed = true;
                            } catch (...) {
                                // Ignore exception
                            }
                            
                            // 4. Copy back if intermediary
                            if (processed && useIntermediary) {
                                buffer.clear();
                                int channelsToCopy = juce::jmin(totalNumOutputChannels, buffer.getNumChannels());
                                for (int ch = 0; ch < channelsToCopy; ch++) {
                                    buffer.copyFrom(ch, 0, intermediaryBuffer, ch, 0, buffer.getNumSamples());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Passthrough / Silence if not processed
    if (!processed) {
        // Just clear any channels beyond input count or all if we failed
        // For now, if we failed, we might want to pass through input 1:1 if possible, or silence.
        // The original code cleared channels > inputChannels.
        for (int ch = totalNumInputChannels; ch < buffer.getNumChannels(); ch++) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }
    
    // Update channel level meters (optimized)
    // Only do this every few blocks to save CPU
    static int levelCounter = 0;
    static int logCounter = 0;
    if ((levelCounter++ & 3) == 0 && buffer.getNumChannels() > 0) { // & 3 is equivalent to % 4
        int numCh = buffer.getNumChannels();
        if (inputChannelLevels.size() < numCh) inputChannelLevels.resize(numCh, 0.0f);
        if (outputChannelLevels.size() < numCh) outputChannelLevels.resize(numCh, 0.0f);
            
        for (int ch = 0; ch < numCh; ch++) {
            float level = buffer.getMagnitude(ch, 0, buffer.getNumSamples());
            
            if (ch < totalNumInputChannels) {
                inputChannelLevels[ch] = 0.7f * inputChannelLevels[ch] + 0.3f * level;
            }
            outputChannelLevels[ch] = 0.7f * outputChannelLevels[ch] + 0.3f * level;
        }
        
        // Log periodic stats (every ~2 seconds at 48kHz/512 buffer size)
        if (logCounter++ > 200) {
            logCounter = 0;
            juce::String logMsg = "M1Transcoder Status: In=" + juce::String(totalNumInputChannels) + 
                                  " Out=" + juce::String(totalNumOutputChannels) +
                                  " Proc=" + (processed ? "Yes" : "No") +
                                  " BufCh=" + juce::String(buffer.getNumChannels());
            DBG(logMsg);
        }
    }

    // Apply output channel mutes
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        if (ch < outputChannelMutes.size() && outputChannelMutes[ch]) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }
}

std::string M1TranscoderAudioProcessor::getTranscodeInputFormat() const {
    return selectedInputFormatName;
}

std::string M1TranscoderAudioProcessor::getTranscodeOutputFormat() const {
    return selectedOutputFormatName;
}

void M1TranscoderAudioProcessor::setTranscodeInputFormat(const std::string &name) {
    if (!name.empty()) {
        int formatEnum = m1Transcode.getFormatFromString(name);
        if (formatEnum != -1) {
            if (selectedInputFormatName != name) {
                selectedInputFormatName = name;
                // We don't need to set m1Transcode here because reconfigureAudioTranscode will do it
                // But we can do it for consistency if reconfigure is not called immediately
                // However, we WILL call reconfigure immediately
                reconfigureAudioTranscode();
            }
        }
    } else {
        // Allow clearing the format
        selectedInputFormatName = name;
        reconfigureAudioTranscode();
    }
}

void M1TranscoderAudioProcessor::setTranscodeOutputFormat(const std::string &name) {
    if (!name.empty()) {
        int formatEnum = m1Transcode.getFormatFromString(name);
        if (formatEnum != -1) {
            if (selectedOutputFormatName != name) {
                selectedOutputFormatName = name;
                reconfigureAudioTranscode();
            }
        }
    } else {
        // Allow clearing the format
        selectedOutputFormatName = name;
        reconfigureAudioTranscode();
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
    // Lock to prevent processBlock from accessing m1Transcode while we modify it
    const juce::SpinLock::ScopedLockType lock(transcodeProcessLock);
    
    int inputChannels = getTotalNumInputChannels();
    int outputChannels = getTotalNumOutputChannels();
    
    if (inputChannels < 1 || outputChannels < 1) {
        return;
    }

    bool inputFormatWasReset = false;
    bool outputFormatWasReset = false;
    
    // Check if input format needs to be set or reset
    bool inputFormatInvalid = selectedInputFormatName.empty() || 
                             m1Transcode.getFormatFromString(selectedInputFormatName) == -1;
    bool inputChannelMismatch = false;
    
    if (!inputFormatInvalid) {
        try {
            // Temporarily set format to check channel count
            int formatEnum = m1Transcode.getFormatFromString(selectedInputFormatName);
            // We are locked, so this is safe
            m1Transcode.setInputFormat(formatEnum);
            int selectedFormatChannels = m1Transcode.getInputNumChannels();
            
            bool exactMatchRequired = parameters.getParameterAsValue(paramShowExactInputChannels).getValue();
            if (exactMatchRequired && (selectedFormatChannels != inputChannels)) {
                inputChannelMismatch = true;
            }
        } catch (...) {
             inputFormatInvalid = true;
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
        // Update selectedInputFormatName
        // Note: setTranscodeInputFormat calls m1Transcode.setInputFormat but also checks name
        // We can just set it directly here since we are in reconfigure
        selectedInputFormatName = newFormat;
        int formatEnum = m1Transcode.getFormatFromString(newFormat);
        if (formatEnum != -1) m1Transcode.setInputFormat(formatEnum);
        
        inputFormatWasReset = true;
    }
    
    // Check if output format needs to be set or reset
    bool outputNeedsReset = false;
    if (selectedOutputFormatName.empty() || m1Transcode.getFormatFromString(selectedOutputFormatName) == -1) {
        outputNeedsReset = true;
    } else if (inputFormatWasReset) {
        outputNeedsReset = true;
    } else {
        // Verify current output format is compatible
        try {
             int inFmt = m1Transcode.getFormatFromString(selectedInputFormatName);
             int outFmt = m1Transcode.getFormatFromString(selectedOutputFormatName);
             m1Transcode.setInputFormat(inFmt);
             m1Transcode.setOutputFormat(outFmt);
             
             if (!m1Transcode.processConversionPath()) {
                 outputNeedsReset = true;
             }
         } catch (...) {
             outputNeedsReset = true;
         }
    }

    if (outputNeedsReset) {
        auto compatibleOutputs = getCompatibleOutputFormats(selectedInputFormatName, outputChannels);
        
        if (!compatibleOutputs.empty()) {
            selectedOutputFormatName = compatibleOutputs[0];
            int formatEnum = m1Transcode.getFormatFromString(selectedOutputFormatName);
            if (formatEnum != -1) m1Transcode.setOutputFormat(formatEnum);
            
            outputFormatWasReset = true;
        } else {
             selectedOutputFormatName = "";
             outputFormatWasReset = true;
        }
    }

    // Final validation
    if (selectedInputFormatName.empty() || selectedOutputFormatName.empty()) {
         pendingFormatChange = false;
         return;
    }

    try {
        int inFmt = m1Transcode.getFormatFromString(selectedInputFormatName);
        int outFmt = m1Transcode.getFormatFromString(selectedOutputFormatName);
        
        m1Transcode.setInputFormat(inFmt);
        m1Transcode.setOutputFormat(outFmt);
        
        // Calculate conversion path
        bool valid = m1Transcode.processConversionPath();
        m_conversionValid = valid;
        
        if (valid) {
            auto path = m1Transcode.getFormatConversionPath();
            juce::String pathStr = "M1Transcoder Path: " + juce::String(selectedInputFormatName) + " -> ";
            for (size_t i = 0; i < path.size(); ++i) {
                pathStr += juce::String(m1Transcode.getFormatName(path[i]));
                if (i < path.size() - 1) pathStr += " -> ";
            }
            pathStr += " (" + juce::String(selectedOutputFormatName) + ")";
            DBG(pathStr);
        } else {
            DBG("M1Transcoder: Conversion Path Invalid for " + juce::String(selectedInputFormatName) + " -> " + juce::String(selectedOutputFormatName));
        }
        
    } catch (...) {
        m_conversionValid = false;
        DBG("M1Transcoder: Exception calculating path");
    }
    
    pendingFormatChange = false;
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
