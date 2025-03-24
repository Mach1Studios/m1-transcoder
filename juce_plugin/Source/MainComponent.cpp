#include "MainComponent.h"
#include "MurkaTypes.h"
#include "UI/M1DropdownButton.h"
#include "UI/M1DropdownMenu.h"
#include "UI/M1CircleMeter.h"
#include "UI/M1ScrollableList.h"
#include <cmath>

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
    inputFormatsList = audioProcessor.getMatchingInputFormatNames(numHostInputChannels);
    
    
    // Setup output mode formats
    int numHostOutputChannels = audioProcessor.getBus(false, 0)->getNumberOfChannels();
    outputFormatsList = audioProcessor.getMatchingOutputFormatNames(inputFormatsList[audioProcessor.selectedInputFormatIndex], numHostOutputChannels);
}

void MainComponent::draw()
{
    int selectedInputFormatIndex = audioProcessor.selectedInputFormatIndex;
    int selectedOutputFormatIndex = audioProcessor.selectedOutputFormatIndex;

    m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, DEFAULT_FONT_SIZE - 1);
    m.setColor(BACKGROUND_GREY);
    m.clear();
    m.setLineWidth(2);

    m.setColor(ENABLED_PARAM);
 
    // Layout input section
    auto& inputLabel = m.prepare<murka::Label>(murka::MurkaShape(20, 20, getWidth() / 3 - 40, 30));
    inputLabel.label = "INPUT";
    inputLabel.alignment = TextAlignment::TEXT_LEFT;
    inputLabel.draw();

    // Input format scrollable list - make it narrower to leave room for meters
    auto& inputList = m.prepare<M1ScrollableList>(murka::MurkaShape(20, 60, getWidth() / 3 - 40, getHeight() - 120));
    inputList.withOptions(inputFormatsList)
        .withFontSize(DEFAULT_FONT_SIZE)
        .withSelectedIndex(selectedInputFormatIndex)
        .withHighlightColor(MurkaColor(ENABLED_PARAM))
        .withTextColor(MurkaColor(LABEL_TEXT_COLOR))
        .withBackgroundColor(MurkaColor(BACKGROUND_GREY))
        .withOutlineColor(MurkaColor(ENABLED_PARAM));
    inputList.draw();

    if (inputList.changed) {
        selectedInputFormatIndex = inputList.selectedIndex;
        auto* paramInputMode = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramInputMode));
        if (paramInputMode) {
            *paramInputMode = selectedInputFormatIndex;
        }

        selectedOutputFormatIndex = 0;
        auto* paramOutputMode = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramOutputMode));
        if (paramOutputMode) {
            *paramOutputMode = selectedOutputFormatIndex;
        }
    }
    
    // Layout output section
    auto& outputLabel = m.prepare<murka::Label>(murka::MurkaShape(2 * getWidth() / 3 + 20, 20, getWidth() / 3 - 40, 30));
    outputLabel.label = "OUTPUT";
    outputLabel.alignment = TextAlignment::TEXT_LEFT;
    outputLabel.draw();

    // Output format scrollable list - make it narrower to leave room for meters
    auto& outputList = m.prepare<M1ScrollableList>(murka::MurkaShape(2 * getWidth() / 3 + 20, 60, getWidth() / 3 - 40, getHeight() - 120));
    outputList.withOptions(outputFormatsList)
        .withFontSize(DEFAULT_FONT_SIZE)
        .withSelectedIndex(selectedOutputFormatIndex)
        .withHighlightColor(MurkaColor(ENABLED_PARAM))
        .withTextColor(MurkaColor(LABEL_TEXT_COLOR))
        .withBackgroundColor(MurkaColor(BACKGROUND_GREY))
        .withOutlineColor(MurkaColor(ENABLED_PARAM));
    outputList.draw();

    if (outputList.changed) {
        selectedOutputFormatIndex = outputList.selectedIndex;
        auto* paramOutputMode = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramOutputMode));
        if (paramOutputMode) {
            *paramOutputMode = selectedOutputFormatIndex;
        }
    }
    
    // Draw channel meters in the center
    drawChannelMeters();
    
    // Draw arrow in the center
    m.setColor(ENABLED_PARAM);
    drawArrow(getWidth() / 2 - 20, getHeight() / 2, getWidth() / 2 + 20, getHeight() / 2, 10);
}

void MainComponent::drawArrow(float startX, float startY, float endX, float endY, float arrowSize)
{
    // Draw the line
    m.drawLine(startX, startY, endX, endY);
    
    // Calculate arrow head
    float angle = std::atan2(endY - startY, endX - startX);
    float arrowAngle1 = angle + 3.14159f * 0.75f;
    float arrowAngle2 = angle - 3.14159f * 0.75f;
    
    float arrowX1 = endX + arrowSize * std::cos(arrowAngle1);
    float arrowY1 = endY + arrowSize * std::sin(arrowAngle1);
    float arrowX2 = endX + arrowSize * std::cos(arrowAngle2);
    float arrowY2 = endY + arrowSize * std::sin(arrowAngle2);
    
    // Draw arrow head
    m.drawLine(endX, endY, arrowX1, arrowY1);
    m.drawLine(endX, endY, arrowX2, arrowY2);
}

void MainComponent::drawChannelMeters()
{
    // Get current input/output formats
    std::string inputFormat = audioProcessor.getTranscodeInputFormat();
    std::string outputFormat = audioProcessor.getTranscodeOutputFormat();
    
    // Get channel counts
    int inputChannels = 0;
    int outputChannels = 0;
    
    for (const auto& format : Mach1TranscodeConstants::formats) {
        if (format.name == inputFormat) {
            inputChannels = format.numChannels;
        }
        if (format.name == outputFormat) {
            outputChannels = format.numChannels;
        }
    }
    
    // Ensure we have at least some channels to display
    inputChannels = std::max(1, inputChannels);
    outputChannels = std::max(1, outputChannels);
    
    // Make sure we have level data
    if (audioProcessor.inputChannelLevels.size() < inputChannels) {
        audioProcessor.inputChannelLevels.resize(inputChannels, 0.0f);
    }
    if (audioProcessor.outputChannelLevels.size() < outputChannels) {
        audioProcessor.outputChannelLevels.resize(outputChannels, 0.0f);
    }
    
    // Calculate grid layout for input meters
    int inputRows = std::min(6, inputChannels);
    int inputCols = (inputChannels + inputRows - 1) / inputRows; // Ceiling division
    float inputMeterSize = 30.0f;
    float inputSpacing = 10.0f;
    float inputStartX = getWidth() / 3 + 20;
    float inputStartY = getHeight() / 2 - (inputRows * (inputMeterSize + inputSpacing)) / 2;
    
    // Draw input meters
    for (int i = 0; i < inputChannels; i++) {
        int row = i % inputRows;
        int col = i / inputRows;
        float x = inputStartX + col * (inputMeterSize + inputSpacing);
        float y = inputStartY + row * (inputMeterSize + inputSpacing);
        
        auto& meter = m.prepare<M1CircleMeter>(murka::MurkaShape(x, y, inputMeterSize, inputMeterSize));
        meter.withLevel(i < audioProcessor.inputChannelLevels.size() ? audioProcessor.inputChannelLevels[i] : 0.0f)
            .withColor(MurkaColor(ENABLED_PARAM))
            .withChannelNumber(i, true);
        meter.draw();
    }
    
    // Calculate grid layout for output meters
    int outputRows = std::min(6, outputChannels);
    int outputCols = (outputChannels + outputRows - 1) / outputRows; // Ceiling division
    float outputMeterSize = 30.0f;
    float outputSpacing = 10.0f;
    float outputStartX = 2 * getWidth() / 3 - 20 - outputCols * (outputMeterSize + outputSpacing);
    float outputStartY = getHeight() / 2 - (outputRows * (outputMeterSize + outputSpacing)) / 2;
    
    // Draw output meters
    for (int i = 0; i < outputChannels; i++) {
        int row = i % outputRows;
        int col = i / outputRows;
        float x = outputStartX + col * (outputMeterSize + outputSpacing);
        float y = outputStartY + row * (outputMeterSize + outputSpacing);
        
        auto& meter = m.prepare<M1CircleMeter>(murka::MurkaShape(x, y, outputMeterSize, outputMeterSize));
        meter.withLevel(i < audioProcessor.outputChannelLevels.size() ? audioProcessor.outputChannelLevels[i] : 0.0f)
            .withColor(MurkaColor(ENABLED_PARAM))
            .withChannelNumber(i, true);
        meter.draw();
    }
} 