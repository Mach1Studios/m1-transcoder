#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "MainComponent.h"

//==============================================================================
/**
*/
class M1TranscoderAudioProcessorEditor  : public juce::AudioProcessorEditor
{
public:
    M1TranscoderAudioProcessorEditor (M1TranscoderAudioProcessor&);
    ~M1TranscoderAudioProcessorEditor() override;

    //==============================================================================
    void paint (juce::Graphics&) override;
    void resized() override;

private:
    // This reference is provided as a quick way for your editor to
    // access the processor object that created it.
    M1TranscoderAudioProcessor& audioProcessor;

    // UI component
    MainComponent* mainComponent = nullptr;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (M1TranscoderAudioProcessorEditor)
};
