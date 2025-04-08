#include "PluginProcessor.h"
#include "PluginEditor.h"

juce::String M1TranscoderAudioProcessor::paramInputMode("inputMode");
juce::String M1TranscoderAudioProcessor::paramOutputMode("outputMode");

//==============================================================================
M1TranscoderAudioProcessor::M1TranscoderAudioProcessor()
     : m_decode_strategy(&M1TranscoderAudioProcessor::nullStrategy),
       m_transcode_strategy(&M1TranscoderAudioProcessor::nullStrategy),
       AudioProcessor(getHostSpecificLayout()),
       parameters(*this, &mUndoManager, juce::Identifier("M1-Transcoder"), {
    std::make_unique<juce::AudioParameterInt>(juce::ParameterID(paramInputMode, 1), TRANS("Input Mode"), 0, 128, 0),
    std::make_unique<juce::AudioParameterInt>(juce::ParameterID(paramOutputMode, 1), TRANS("Output Mode"), 0, 128, 0)
       })
{
    parameters.addParameterListener(paramInputMode, this);
    parameters.addParameterListener(paramOutputMode, this);

    // print build time for debug
    juce::String date(__DATE__);
    juce::String time(__TIME__);
    DBG("[Transcoder] Build date: " + date + " | Build time: " + time);
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
    // First, check if we're in a valid state to process
    if (!bufferToFill.buffer || bufferToFill.numSamples <= 0) {
        return; // Invalid buffer, just return silently
    }

    // Get input and output channel counts
    int inChannels = 0;
    int outChannels = 0;
    
    try {
        inChannels = m1Transcode.getInputNumChannels();
        outChannels = m1Transcode.getOutputNumChannels();
    } catch (...) {
        // If we can't even get channel counts, something is very wrong
        Mach1::AlertData data { "FORMAT ERROR", "Unable to determine channel counts for selected formats.", "OK" };
        postAlert(data);

        // Switch to null strategy to prevent further crashes
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        return;
    }

    if (inChannels <= 0 || outChannels <= 0) {
        // Display error to user
        Mach1::AlertData data { "CHANNEL COUNT ERROR", "Invalid channel count for selected formats.", "OK" };
        postAlert(data);
        
        // Switch to null strategy to prevent further crashes
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        return;
    }

    // Verify that we have enough channels in our buffers
    if (readBuffer.getNumChannels() < inChannels) {
        Mach1::AlertData data { "INPUT CHANNEL ERROR", "Not enough input channels available for the selected format.", "OK" };
        postAlert(data);
        
        // Switch to null strategy to prevent further crashes
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        return;
    }

    // Verify that the number of samples is reasonable
    auto sampleCount = bufferToFill.numSamples;
    if (sampleCount <= 0 || sampleCount > 16384) {
        Mach1::AlertData data { "BUFFER SIZE ERROR", "Invalid buffer size for processing.", "OK" };
        postAlert(data);
        
        // Switch to null strategy to prevent further crashes
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        return;
    }

    // Resize output buffer if needed
    try {
        if (intermediaryBuffer.getNumChannels() != outChannels || intermediaryBuffer.getNumSamples() != sampleCount) {
            intermediaryBuffer.setSize(outChannels, sampleCount, false, true, true); // Clear new space
        }
    } catch (...) {
        Mach1::AlertData data { "BUFFER ALLOCATION ERROR", "Failed to allocate buffer for output format.", "OK" };
        postAlert(data);
        
        // Switch to null strategy to prevent further crashes
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        return;
    }

    // Clear the output buffer before processing
    intermediaryBuffer.clear();

    // Create safe input pointers
    std::vector<float*> readPtrs(inChannels, nullptr);
    static float silentBuffer[16384] = {0}; // Static buffer for safety
    
    for (int i = 0; i < inChannels; i++) {
        if (i < readBuffer.getNumChannels()) {
            readPtrs[i] = readBuffer.getWritePointer(i);
        } else {
            readPtrs[i] = silentBuffer;
        }
        
        // Double-check for null pointers
        if (readPtrs[i] == nullptr) {
            readPtrs[i] = silentBuffer;
        }
    }

    // Create safe output pointers
    std::vector<float*> intermediaryPtrs(outChannels, nullptr);
    for (int i = 0; i < outChannels; i++) {
        if (i < intermediaryBuffer.getNumChannels()) {
            intermediaryPtrs[i] = intermediaryBuffer.getWritePointer(i);
        } else {
            intermediaryPtrs[i] = silentBuffer;
        }
        
        // Double-check for null pointers
        if (intermediaryPtrs[i] == nullptr) {
            intermediaryPtrs[i] = silentBuffer;
        }
    }

    // Use our safer process conversion method
    bool conversionSucceeded = safeProcessConversion(readPtrs.data(), intermediaryPtrs.data(), sampleCount);

    // Only copy to output if conversion succeeded
    if (conversionSucceeded) {
        // Copy the processed audio to the output buffer
        for (int channel = 0; channel < bufferToFill.buffer->getNumChannels() && channel < intermediaryBuffer.getNumChannels(); ++channel) {
            bufferToFill.buffer->copyFrom(channel, bufferToFill.startSample, 
                                         intermediaryBuffer.getReadPointer(channel), 
                                         bufferToFill.numSamples);
        }
    } else {
        // If conversion failed, output silence
        for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel) {
            bufferToFill.buffer->clear(channel, bufferToFill.startSample, bufferToFill.numSamples);
        }
        
        // Show error
        Mach1::AlertData data { "TRANSCODE ERROR", "Failed to process audio conversion. Switching to passthrough mode.", "OK" };
        postAlert(data);
        
        // Switch to null strategy to prevent further crashes
        m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
    }
}

void M1TranscoderAudioProcessor::nullStrategy(const AudioSourceChannelInfo &bufferToFill)
{
    // Display error to user
    Mach1::AlertData data { "OUTPUT ERROR", "No valid audio strategy available.", "OK" };
    postAlert(data);
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
        auto availableInputFormats = getMatchingInputFormatNames(getTotalNumInputChannels());

        if (availableInputFormats.size() > 0)
        {
            int index = static_cast<int>(newValue);
            // Ensure index is in valid range
            if (index >= 0 && index < static_cast<int>(availableInputFormats.size()))
            {
                selectedInputFormatIndex = index;  // Store the index
                setTranscodeInputFormat(availableInputFormats[index]);

                auto availableOutputFormats = getMatchingOutputFormatNames(availableInputFormats[selectedInputFormatIndex], getTotalNumOutputChannels());
                
                // Check if there are any compatible output formats
                if (availableOutputFormats.size() > 0) {
                    selectedOutputFormatIndex = 0;  
                    setTranscodeOutputFormat(availableOutputFormats[selectedOutputFormatIndex]);
                    
                    // Verify that the conversion path is valid
                    if (!m1Transcode.processConversionPath()) {
                        // No valid conversion path - show error
                        Mach1::AlertData data { "Invalid conversion path", "Cannot convert between selected formats.", "OK" };
                        postAlert(data);
                    }
                } else {
                    // No compatible output formats found - handle this case
                    selectedOutputFormatIndex = 0;
                    // Don't try to set an output format if none are available
                    // Just show an error message
                    Mach1::AlertData data { "No compatible output formats", "The selected input format has no compatible output formats for the current channel configuration.", "OK" };
                    postAlert(data);
                }
            }
        }
        pendingFormatChange = true;
    }
    else if (parameterID == paramOutputMode)
    {
        auto availableInputFormats = getMatchingInputFormatNames(getTotalNumInputChannels());
        auto availableOutputFormats = getMatchingOutputFormatNames(availableInputFormats[selectedInputFormatIndex], getTotalNumOutputChannels());

        if (availableOutputFormats.size() > 0)
        {
            int index = static_cast<int>(newValue);
            
            // Ensure index is in valid range
            if (index >= 0 && index < static_cast<int>(availableOutputFormats.size()))
            {
                selectedOutputFormatIndex = index;  // Store the index
                setTranscodeOutputFormat(availableOutputFormats[index]);
                
                // Verify that the conversion path is valid
                if (!m1Transcode.processConversionPath()) {
                    // No valid conversion path - show error
                    Mach1::AlertData data { "Invalid conversion path", "Cannot convert between selected formats.", "OK" };
                    postAlert(data);
                }
            }
        }
        pendingFormatChange = true;
    }
    else
    {
        // error / unhandled param
    }
}


void M1TranscoderAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    readBuffer.setSize(totalNumOutputChannels, buffer.getNumSamples());
    readBuffer.clear();
    
    tempBuffer.setSize(totalNumOutputChannels * 2, buffer.getNumSamples());
    tempBuffer.clear();

    // if you've got more output channels than input clears extra outputs
    for (auto channel = totalNumInputChannels; channel < 2 && channel < totalNumInputChannels; ++channel) {
        readBuffer.clear(channel, 0, buffer.getNumSamples());
    }

    // config transcode
    if (pendingFormatChange ||
        m1Transcode.getFormatName(m1Transcode.getInputFormat()) != selectedInputFormat ||
        m1Transcode.getFormatName(m1Transcode.getOutputFormat()) != selectedOutputFormat) {
        reconfigureAudioTranscode();
        reconfigureAudioDecode();
    }

    // Apply input channel mutes
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        if (ch < inputChannelMutes.size() && inputChannelMutes[ch]) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }

    // Processing loop
    juce::AudioSourceChannelInfo bufferToFill(&buffer, 0, buffer.getNumSamples());
    (this->*m_transcode_strategy)(bufferToFill);
    //(this->*m_decode_strategy)(bufferToFill);

    // Update input levels
    inputChannelLevels.resize(buffer.getNumChannels());
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        float level = 0.0f;
        const float* channelData = buffer.getReadPointer(ch);
        for (int i = 0; i < buffer.getNumSamples(); i++) {
            level = std::max(level, std::abs(channelData[i]));
        }
        // Smooth the level
        inputChannelLevels[ch] = 0.7f * inputChannelLevels[ch] + 0.3f * level;
    }
    
    // Update output levels (using the same buffer after processing)
    outputChannelLevels.resize(buffer.getNumChannels());
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        float level = 0.0f;
        const float* channelData = buffer.getReadPointer(ch);
        for (int i = 0; i < buffer.getNumSamples(); i++) {
            level = std::max(level, std::abs(channelData[i]));
        }
        // Smooth the level
        outputChannelLevels[ch] = 0.7f * outputChannelLevels[ch] + 0.3f * level;
    }

    // After processing, add this code to apply output channel mutes
    for (int ch = 0; ch < buffer.getNumChannels(); ch++) {
        if (ch < outputChannelMutes.size() && outputChannelMutes[ch]) {
            buffer.clear(ch, 0, buffer.getNumSamples());
        }
    }
}

std::string M1TranscoderAudioProcessor::getTranscodeInputFormat() const {
    return selectedInputFormat;
}

std::string M1TranscoderAudioProcessor::getTranscodeOutputFormat() const {
    return selectedOutputFormat;
}

void M1TranscoderAudioProcessor::setTranscodeInputFormat(const std::string &name) {
    if (!name.empty() && m1Transcode.getFormatFromString(name) != -1) {
        // Queue the format change instead of applying immediately
        m1Transcode.setInputFormat(m1Transcode.getFormatFromString(name));
        selectedInputFormat = name;
        pendingFormatChange = true;
    }
}

void M1TranscoderAudioProcessor::setTranscodeOutputFormat(const std::string &name) {
    if (!name.empty() && m1Transcode.getFormatFromString(name) != -1) {
        // Queue the format change instead of applying immediately
        m1Transcode.setOutputFormat(m1Transcode.getFormatFromString(name));
        selectedOutputFormat = name;
        pendingFormatChange = true;
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
    // Default to null strategy
    m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;

    if (getTotalNumInputChannels() < 1 || getTotalNumOutputChannels() < 1)
    {
        return;
    }

    // Use selected format if available, otherwise use default behavior
    if (!selectedInputFormat.empty()) {
        setTranscodeInputFormat(selectedInputFormat);
        setTranscodeOutputFormat(selectedOutputFormat);

        // TODO: Add more format overrides for higher order ambisonic to 38ch when ready
        
        if (m1Transcode.processConversionPath())
        {
            m_transcode_strategy = &M1TranscoderAudioProcessor::intermediaryBufferTranscodeStrategy;
        }
        else
        {
            m_transcode_strategy = &M1TranscoderAudioProcessor::nullStrategy;
        }
        pendingFormatChange = false;
    }
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
        
        // Update the formats based on restored indices
        auto availableInputFormats = getMatchingInputFormatNames(getTotalNumInputChannels());
        auto availableOutputFormats = getMatchingOutputFormatNames(availableInputFormats[selectedInputFormatIndex], getTotalNumOutputChannels());
        
        if (!availableInputFormats.empty() && selectedInputFormatIndex >= 0 && selectedInputFormatIndex < static_cast<int>(availableInputFormats.size()))
            setTranscodeInputFormat(availableInputFormats[selectedInputFormatIndex]);
            
        if (!availableOutputFormats.empty() && selectedOutputFormatIndex >= 0 && selectedOutputFormatIndex < static_cast<int>(availableOutputFormats.size()))
            setTranscodeOutputFormat(availableOutputFormats[selectedOutputFormatIndex]);
    }
}

//==============================================================================
// This creates new instances of the plugin..
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new M1TranscoderAudioProcessor();
}

bool M1TranscoderAudioProcessor::safeProcessConversion(float** inBufs, float** outBufs, int numSamples) {
    // Use a critical section to ensure thread safety
    const juce::ScopedLock lock(transcodeProcessLock);
    
    // Validate inputs
    if (!inBufs || !outBufs || numSamples <= 0) {
        return false;
    }
    
    // Check for null pointers in the arrays
    int inChannels = m1Transcode.getInputNumChannels();
    int outChannels = m1Transcode.getOutputNumChannels();
    
    for (int i = 0; i < inChannels; i++) {
        if (!inBufs[i]) return false;
    }
    
    for (int i = 0; i < outChannels; i++) {
        if (!outBufs[i]) return false;
    }
    
    // Verify that the conversion path is valid
    if (!m1Transcode.processConversionPath()) {
        return false;
    }
    
    // Get the conversion path to check if it's valid
    std::vector<int> conversionPath;
    try {
        conversionPath = m1Transcode.getFormatConversionPath();
        if (conversionPath.size() < 2) {
            // Need at least input and output formats
            return false;
        }
    } catch (...) {
        return false;
    }
    
    // Now try the actual conversion
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
