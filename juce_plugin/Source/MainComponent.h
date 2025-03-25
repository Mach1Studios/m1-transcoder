#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "juce_murka/JuceMurkaBaseComponent.h"

class MainComponent : public murka::JuceMurkaBaseComponent
{
public:
    MainComponent(M1TranscoderAudioProcessor& p);
    ~MainComponent() override;

    void initialise() override;
    void draw() override;
    void drawChannelMeters();
    void drawArrow(float startX, float startY, float endX, float endY, float arrowSize);

private:
    // This reference is provided as a quick way to access the processor object
    M1TranscoderAudioProcessor& audioProcessor;

    MurImage m1logo;

    std::vector<std::string> inputFormatsList;
    std::vector<std::string> outputFormatsList;
   
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainComponent)
}; 
