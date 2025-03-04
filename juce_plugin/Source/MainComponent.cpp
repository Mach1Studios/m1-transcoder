#include "MainComponent.h"
#include "UI/M1Combobox.h"
#include "MurkaTypes.h"

MainComponent::MainComponent(M1TranscoderAudioProcessor& p)
    : murka::JuceMurkaBaseComponent(), audioProcessor(p)
{
    setSize(getWidth(), getHeight());
}

MainComponent::~MainComponent()
{
    shutdownOpenGL();
}

void MainComponent::initialise()
{
    JuceMurkaBaseComponent::initialise();
 
    // Setup input mode formats
    int numHostInputChannels = audioProcessor.getBus(true, 0)->getNumberOfChannels();
    inputFormatsList = audioProcessor.getMatchingFormatNames(numHostInputChannels);
    
    
    // Setup output mode formats
    int numHostOutputChannels = audioProcessor.getBus(false, 0)->getNumberOfChannels();
    outputFormatsList = audioProcessor.getMatchingFormatNames(numHostOutputChannels);
}

void MainComponent::draw()
{

    m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, DEFAULT_FONT_SIZE - 1);
    m.setColor(BACKGROUND_GREY);
    m.clear();
    m.setLineWidth(2);

    m.setColor(ENABLED_PARAM);
 
    // Layout input mode controls
    auto& inputLabel = m.prepare<murka::Label>(murka::MurkaShape(10, 10, getWidth() - 20, 20));
    inputLabel.label =  "Input Mode";
    inputLabel.alignment = TextAlignment::TEXT_LEFT;
    inputLabel.draw();

    // Input mode dropdown button
    auto& inputButton = m.prepare<M1DropdownButton>(murka::MurkaShape(10, 35, getWidth() - 20, 40));
    int selectedInputFormatIndex = audioProcessor.selectedInputFormatIndex;
    inputButton.withLabel(selectedInputFormatIndex >= 0 && selectedInputFormatIndex < inputFormatsList.size() 
        ? inputFormatsList[selectedInputFormatIndex] 
        : "SELECT");
    inputButton.withOutline(true)
        .withTriangle(true)
        .withFontSize(DEFAULT_FONT_SIZE)
        .withLabelColor(MurkaColor(LABEL_TEXT_COLOR));
    inputButton.draw();

    auto& inputMenu = m.prepare<M1DropdownMenu>(murka::MurkaShape(10, 75, getWidth() - 20, 
        (std::min)(60.0f, inputFormatsList.size() * 30.0f)));

    // Show dropdown menu when button is pressed
    if (inputButton.pressed) {
          inputMenu.open();
    }
    inputMenu.withOptions(inputFormatsList)
        .withFontSize(DEFAULT_FONT_SIZE)
        .withHighlightLabelColor(MurkaColor(ENABLED_PARAM))
        .withLabelColor(MurkaColor(LABEL_TEXT_COLOR))
        .withBackgroundColor(MurkaColor(BACKGROUND_GREY))
        .withOutlineColor(MurkaColor(ENABLED_PARAM));
    inputMenu.selectedOption = selectedInputFormatIndex;

    inputMenu.draw();

    if (inputMenu.changed) {
        selectedInputFormatIndex = inputMenu.selectedOption;
        auto* param = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramInputMode));
        if (param) {
            *param = selectedInputFormatIndex;
        }
    }
    
    // Layout output mode controls
    auto& outputLabel = m.prepare<murka::Label>(murka::MurkaShape(10, 145, getWidth() - 20, 20));
    outputLabel.label =  "Output Mode";
    outputLabel.alignment = TEXT_LEFT;
    outputLabel.draw();

    // Output mode dropdown button
    auto& outputButton = m.prepare<M1DropdownButton>(murka::MurkaShape(10, 170, getWidth() - 20, 40));
    int selectedOutputFormatIndex = audioProcessor.selectedOutputFormatIndex;
    outputButton.withLabel(selectedOutputFormatIndex >= 0 && selectedOutputFormatIndex < outputFormatsList.size() 
        ? outputFormatsList[selectedOutputFormatIndex] 
        : "SELECT");
    outputButton.withOutline(true)
        .withTriangle(true)
        .withFontSize(DEFAULT_FONT_SIZE)
        .withLabelColor(MurkaColor(LABEL_TEXT_COLOR));
    outputButton.draw();

    // Show dropdown menu when button is pressed
    auto& outputMenu = m.prepare<M1DropdownMenu>(murka::MurkaShape(10, 210, getWidth() - 20, 
        (std::min)(60.0f, outputFormatsList.size() * 30.0f)));

    if (outputButton.pressed) {
        outputMenu.open();
    }

    outputMenu.withOptions(outputFormatsList)
        .withFontSize(DEFAULT_FONT_SIZE)
        .withHighlightLabelColor(MurkaColor(ENABLED_PARAM))
        .withLabelColor(MurkaColor(LABEL_TEXT_COLOR))
        .withBackgroundColor(MurkaColor(BACKGROUND_GREY))
        .withOutlineColor(MurkaColor(ENABLED_PARAM));
    outputMenu.selectedOption = selectedOutputFormatIndex;
    
    outputMenu.draw();

    if (outputMenu.changed) {
        selectedOutputFormatIndex = outputMenu.selectedOption;
        auto* param = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramOutputMode));
        if (param) {
            *param = selectedOutputFormatIndex;
        }
    }
} 