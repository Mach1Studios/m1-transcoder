#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "juce_murka/JuceMurkaBaseComponent.h"
#include "AlertData.h"
#include "UI/M1AlertComponent.h"

class MainComponent : public murka::JuceMurkaBaseComponent
{
public:
    MainComponent(M1TranscoderAudioProcessor& p);
    ~MainComponent() override;

    void initialise() override;
    void draw() override;
    void drawChannelMeters();
    void drawArrow(float startX, float startY, float endX, float endY, float arrowSize);
    
    void updateFormatLists();
    
    void showAlert(const std::string& title, const std::string& message, const std::string& buttonText = "OK");
    void postAlert(const Mach1::AlertData& alert); // Adds a new alert to the queue

private:
    // This reference is provided as a quick way to access the processor object
    M1TranscoderAudioProcessor& audioProcessor;

    MurImage m1logo;

    std::vector<std::string> inputFormatsList;
    std::vector<std::string> outputFormatsList;
    
    std::vector<std::string> compatibleOutputFormats;
    
    M1AlertComponent murkaAlert;
    juce::OwnedArray<Mach1::AlertData> alertQueue; // queue for alerts
    Mach1::AlertData currentAlert;
    bool hasActiveAlert = false;
   
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainComponent)
}; 
