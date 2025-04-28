#pragma once

#include <JuceHeader.h>

#include "Config.h"
#include "AlertData.h"
#include "Mach1Decode.h"
#include "Mach1Encode.h"
#include "Mach1Transcode.h"
#include "Mach1TranscodeConstants.h"

#define MINUS_3DB_AMP (0.707945784f)
#define MINUS_6DB_AMP (0.501187234f)

//==============================================================================
/**
*/
class M1TranscoderAudioProcessor  : public juce::AudioProcessor, juce::AudioProcessorValueTreeState::Listener
{
public:
    //==============================================================================
    M1TranscoderAudioProcessor();
    ~M1TranscoderAudioProcessor() override;

    //==============================================================================
    static AudioProcessor::BusesProperties getHostSpecificLayout()
    {
        // This determines the initial bus i/o for plugin on construction and depends on the `isBusesLayoutSupported()`
        juce::PluginHostType hostType;

        if (hostType.isProTools() || hostType.getPluginLoadedAs() == AudioProcessor::wrapperType_AAX)
        {
            // Pro Tools needs a fixed, stable initial configuration
            return BusesProperties()
                .withInput("IN", juce::AudioChannelSet::quadraphonic(), true)
                .withOutput("OUT", juce::AudioChannelSet::quadraphonic(), true);
        }
        else if (hostType.getPluginLoadedAs() == AudioProcessor::wrapperType_VST3)
        {
            return BusesProperties()
                // VST3 requires named plugin configurations only
                .withInput("IN", juce::AudioChannelSet::namedChannelSet(4), true)
                .withOutput("OUT", juce::AudioChannelSet::namedChannelSet(4), true);
        }
        else
        {
            return BusesProperties()
                .withInput("IN", juce::AudioChannelSet::discreteChannels(4), true)
                .withOutput("OUT", juce::AudioChannelSet::discreteChannels(4), true);
        }
    }
    
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void parameterChanged(const juce::String& parameterID, float newValue) override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    static juce::String paramInputMode;
    static juce::String paramOutputMode;

    //==============================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    //==============================================================================
    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    //==============================================================================
    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;

    //==============================================================================
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    //==============================================================================
    void reconfigureAudioDecode();
    void reconfigureAudioTranscode();

    void fallbackDecodeStrategy(const AudioSourceChannelInfo& bufferToFill);
    void intermediaryBufferDecodeStrategy(const AudioSourceChannelInfo& bufferToFill);
    void intermediaryBufferTranscodeStrategy(const AudioSourceChannelInfo & bufferToFill);
    void nullStrategy(const AudioSourceChannelInfo& bufferToFill);

    std::string getTranscodeInputFormat() const;
    std::string getTranscodeOutputFormat() const;
    void setTranscodeInputFormat(const std::string &name);
    void setTranscodeOutputFormat(const std::string &name);

    /*
    std::vector<std::string> getMatchingFormatNames(int numChannels) {
        std::vector<std::string> matchingFormatNames;

        for (const auto& format : Mach1TranscodeConstants::formats) {
            if (format.numChannels == numChannels) {
                matchingFormatNames.push_back(format.name);
            }
        }
        return matchingFormatNames;
    }
    */
    
    std::map< int, std::vector<std::string> > matchingInputFormatNamesMap;
    std::map< std::string, std::map< int, std::vector<std::string> > > matchingOutputFormatNamesMap;

    // get all input formats for a given number of channels or less
    std::vector<std::string> getMatchingInputFormatNames(int numChannels) {
        std::vector<std::string> matchingFormatNames;
        
        for (const auto& format : Mach1TranscodeConstants::formats) {
            if (format.numChannels == numChannels) {
                matchingFormatNames.push_back(format.name);
            }
        }
        
        if (matchingFormatNames.empty()) {
            for (const auto& format : Mach1TranscodeConstants::formats) {
                if (format.numChannels > 0 && format.numChannels <= numChannels) {
                    matchingFormatNames.push_back(format.name);
                }
            }
        }
        
        return matchingFormatNames;
    }

    // get all output formats for a given input format and number of channels or less
    std::vector<std::string> getMatchingOutputFormatNames(const std::string& inputFormat, int numChannels) {
        std::vector<std::string> matchingFormatNames;
        
        for (const auto& format : Mach1TranscodeConstants::formats) {
            if (format.numChannels == numChannels) {
                if (inputFormat == format.name) {
                    continue;
                }
                
                try {
                    Mach1Transcode<float> tempTranscode;
                    
                    tempTranscode.setInputFormat(tempTranscode.getFormatFromString(inputFormat));
                    tempTranscode.setOutputFormat(tempTranscode.getFormatFromString(format.name));
                    
                    // Check if conversion path is valid
                    if (tempTranscode.processConversionPath()) {
                        auto path = tempTranscode.getFormatConversionPath();
                        if (path.size() >= 2) {
                            matchingFormatNames.push_back(format.name);
                        }
                    }
                } catch (...) {
                    continue;
                }
            }
        }
        
        return matchingFormatNames;
    }


    std::string getDefaultFormatForChannelCount(int numChannels) {
        switch (numChannels) {
            case 3:  return "3.0_LCR";
            case 4:  return "M1Spatial-4";
            case 5:  return "5.0_C";
            case 6:  return "5.1_C";
            case 7:  return "7.0_C";
            case 8:  return "M1Spatial-8";
            case 9:  return "ACNSN3DO2A";
            case 10: return "7.1.2_C";
            case 11: return "7.0.6_C";
            case 12: return "7.1.4_C";
            case 14: return "M1Spatial-14";
            case 16: return "ACNSN3DO3A";
            case 24: return "ACNSN3DO4A";
            case 36: return "ACNSN3DO5A";
            case 64: return "ACNSN3DO6A";
            default: return "";
        }
    }

    // Error display
    bool showErrorPopup = false;
    std::string errorMessage = "";
    std::string errorMessageInfo = "";
    float fadeDuration = 5.0f;
    float errorOpacity = 0.0f;
    std::chrono::time_point<std::chrono::steady_clock> errorStartTime;

    juce::AudioProcessorValueTreeState parameters;

    std::string selectedInputFormat = "";
    std::string selectedOutputFormat = "";
    int selectedInputFormatIndex = 0;
    int selectedOutputFormatIndex = 0;

    std::vector<float> inputChannelLevels;
    std::vector<float> outputChannelLevels;
    std::vector<bool> inputChannelMutes;
    std::vector<bool> outputChannelMutes;

    std::vector<std::string> getCompatibleOutputFormats(const std::string &inputFormat, int outputChannels) {
        std::vector<std::string> compatibleFormats = getMatchingOutputFormatNames(inputFormat, outputChannels);
        
        if (compatibleFormats.empty()) {
            int inputChannels = 0;
            for (const auto& format : Mach1TranscodeConstants::formats) {
                if (format.name == inputFormat) {
                    inputChannels = format.numChannels;
                    break;
                }
            }
            
            if (inputChannels == outputChannels) {
                return {inputFormat};
            }
            
            for (const auto& format : Mach1TranscodeConstants::formats) {
                if (format.numChannels == outputChannels) {
                    return {format.name};
                }
            }
        }
        
        return compatibleFormats;
    }
    
    // This will be set by the UI or editor so we can notify it of alerts
    std::function<void(const Mach1::AlertData&)> postAlertToUI;
    void postAlert(const Mach1::AlertData& alert);
    std::vector<Mach1::AlertData> pendingAlerts;

private:
    juce::UndoManager mUndoManager;
    
    // Mach1Decode API
    Mach1Decode<float> m1Decode;
    std::vector<float> spatialMixerCoeffs;
    std::vector< juce::LinearSmoothedValue<float> > smoothedChannelCoeffs;
    juce::AudioBuffer<float> tempBuffer;
    juce::AudioBuffer<float> readBuffer;
    juce::AudioBuffer<float> intermediaryBuffer;

    // Mach1Transcode API
    Mach1Transcode<float> m1Transcode;
    std::vector<float> transcodeToDecodeCoeffs;
    std::vector< std::vector<float> > conversionMatrix;
    
    std::vector<std::string> currentFormatOptions;
    std::atomic<bool> pendingFormatChange{false};

    juce::CriticalSection audioCallbackLock;
    juce::CriticalSection renderCallbackLock;

    void (M1TranscoderAudioProcessor::*m_decode_strategy)(const AudioSourceChannelInfo&);
    void (M1TranscoderAudioProcessor::*m_transcode_strategy)(const AudioSourceChannelInfo&);

    juce::SpinLock transcodeProcessLock;
    bool safeProcessConversion(float** inBufs, float** outBufs, int numSamples);

    //==============================================================================
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (M1TranscoderAudioProcessor)
};
