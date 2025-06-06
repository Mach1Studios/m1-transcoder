#include "MainComponent.h"
#include "MurkaTypes.h"
#include "UI/M1Label.h"
#include "UI/M1DropdownButton.h"
#include "UI/M1DropdownMenu.h"
#include "UI/M1CircleMeter.h"
#include "UI/M1ScrollableList.h"
#include <cmath>

MainComponent::MainComponent(M1TranscoderAudioProcessor& p)
    : murka::JuceMurkaBaseComponent(), audioProcessor(p)
{
    setSize(getWidth(), getHeight());
    
    // Set up alert dismiss callback
    murkaAlert.onDismiss = [this]() {
        // remove the top alert from our queue
        if (alertQueue.size() > 0) {
            alertQueue.remove(0);
        }
        murkaAlert.alertActive = false;
    };

    audioProcessor.postAlertToUI = [this](const Mach1::AlertData& alert) {
        this->postAlert(alert);
    };

}

MainComponent::~MainComponent()
{
    shutdownOpenGL();
}

void MainComponent::initialise()
{
    JuceMurkaBaseComponent::initialise();
    m1logo.loadFromRawData(BinaryData::mach1logo_png, BinaryData::mach1logo_pngSize);
    
    // Initialize format lists
    updateFormatLists();
}

void MainComponent::draw()
{
    static int lastInputChannels = -1;
    static int lastOutputChannels = -1;
    static std::string lastInputFormat = "";
    static std::string lastOutputFormat = "";
    
    int currentInputChannels = audioProcessor.getBus(true, 0)->getNumberOfChannels();
    int currentOutputChannels = audioProcessor.getBus(false, 0)->getNumberOfChannels();
    std::string currentInputFormat = audioProcessor.getTranscodeInputFormat();
    std::string currentOutputFormat = audioProcessor.getTranscodeOutputFormat();
    
    // Get state for both filters (using new names)
    bool showExactInputState = audioProcessor.parameters.getParameterAsValue(M1TranscoderAudioProcessor::paramShowExactInputChannels).getValue();
    bool showExactOutputState = audioProcessor.parameters.getParameterAsValue(M1TranscoderAudioProcessor::paramShowExactOutputChannels).getValue();
    static bool lastShowExactInputState = !showExactInputState;
    static bool lastShowExactOutputState = !showExactOutputState;
    
    // Check if channel counts, selected formats, OR either filter mode changed
    if (currentInputChannels != lastInputChannels || 
        currentOutputChannels != lastOutputChannels ||
        currentInputFormat != lastInputFormat ||
        currentOutputFormat != lastOutputFormat ||
        showExactInputState != lastShowExactInputState || 
        showExactOutputState != lastShowExactOutputState) {
        
        updateFormatLists();
        
        lastInputChannels = currentInputChannels;
        lastOutputChannels = currentOutputChannels;
        lastInputFormat = currentInputFormat;
        lastOutputFormat = currentOutputFormat;
        lastShowExactInputState = showExactInputState;
        lastShowExactOutputState = showExactOutputState;
    }
    
    int selectedInputFormatIndex = audioProcessor.selectedInputFormatIndex;
    int selectedOutputFormatIndex = audioProcessor.selectedOutputFormatIndex;

    // Check if we need to show an error alert
    if (audioProcessor.showErrorPopup && !hasActiveAlert) {
        murkaAlert.alertActive = true;
        murkaAlert.alert.title = audioProcessor.errorMessage;
        murkaAlert.alert.message = audioProcessor.errorMessageInfo;
        hasActiveAlert = true;
    }

    m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, DEFAULT_FONT_SIZE - 3);
    m.setColor(BACKGROUND_GREY);
    m.clear();
    m.setLineWidth(2);

    m.setColor(ENABLED_PARAM);
 
    // Layout input section
    auto& inputLabel = m.prepare<murka::Label>(murka::MurkaShape(20, 20, getWidth() / 4 - 40, 30));
    inputLabel.label = "INPUT";
    inputLabel.alignment = TextAlignment::TEXT_LEFT;
    inputLabel.draw();

    // Input format scrollable list - Prepare it *before* using its shape for button placement
    float filterButtonHeight = 20;
    float listHeight = getHeight() - 100 - filterButtonHeight - 10; // Calculate adjusted height
    auto& inputList = m.prepare<M1ScrollableList>(murka::MurkaShape(20, 40, getWidth() / 3 - 40, listHeight)); 
    inputList.withOptions(inputFormatsList)
        .withFontSize(DEFAULT_FONT_SIZE - 4)
        .withSelectedIndex(selectedInputFormatIndex)
        .withHighlightColor(MurkaColor(ENABLED_PARAM))
        .withTextColor(MurkaColor(LABEL_TEXT_COLOR))
        .withBackgroundColor(MurkaColor(BACKGROUND_GREY))
        .withOutlineColor(MurkaColor(ENABLED_PARAM))
        .withSelectedColor(MurkaColor(GRID_LINES_2));
    // Defer drawing the list until after the button

    // --- Input Filter Button ---
    float filterButtonWidth = getWidth() / 3 - 40; // Match list width
    float inputFilterButtonY = 40 + listHeight + 5; // Position below the list area
    auto& inputFilterButton = m.prepare<M1DropdownButton>(murka::MurkaShape(20, inputFilterButtonY, filterButtonWidth, filterButtonHeight));
    inputFilterButton.withLabel(showExactInputState ? "Filter: ==" : "Filter: <=")
                     .withFontSize(DEFAULT_FONT_SIZE - 5)
                     .withLabelColor(MurkaColor(ENABLED_PARAM)) // Corrected color arg
                     .withOutlineColor(MurkaColor(ENABLED_PARAM)) // Corrected color arg
                     .withOutline(true);
    inputFilterButton.draw();

    if (inputFilterButton) { // Check if pressed
        auto* param = audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramShowExactInputChannels);
        param->setValueNotifyingHost(!showExactInputState); // Toggle the value
    }

    // Now draw the input list
    inputList.draw(); 

    if (inputList.changed) {
        selectedInputFormatIndex = inputList.selectedIndex;
        auto* paramInputMode = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramInputMode));
        if (paramInputMode) {
            *paramInputMode = selectedInputFormatIndex;
        }

        // Update the output format list when input format changes
        updateFormatLists();
        
        selectedOutputFormatIndex = 0;
        auto* paramOutputMode = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramOutputMode));
        if (paramOutputMode && !outputFormatsList.empty()) {
            *paramOutputMode = selectedOutputFormatIndex;
        }
    }
    
    // Layout output section
    m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, DEFAULT_FONT_SIZE - 3);
    auto& outputLabel = m.prepare<murka::Label>(murka::MurkaShape(2 * getWidth() / 3 + 20, 20, getWidth() / 3 - 40, 30));
    outputLabel.label = "OUTPUT";
    outputLabel.alignment = TextAlignment::TEXT_LEFT;
    outputLabel.draw();

    // Output format scrollable list
    auto& outputList = m.prepare<M1ScrollableList>(murka::MurkaShape(2 * getWidth() / 3 + 20, 40, getWidth() / 3 - 40, listHeight)); // Use same adjusted height
    outputList.withOptions(outputFormatsList)
        .withFontSize(DEFAULT_FONT_SIZE - 4)
        .withSelectedIndex(selectedOutputFormatIndex)
        .withHighlightColor(MurkaColor(ENABLED_PARAM))
        .withTextColor(MurkaColor(LABEL_TEXT_COLOR))
        .withBackgroundColor(MurkaColor(BACKGROUND_GREY))
        .withOutlineColor(MurkaColor(ENABLED_PARAM))
        .withSelectedColor(MurkaColor(GRID_LINES_2))
        .withCompatibleFormats(compatibleOutputFormats)  // Pass the list of compatible formats
        .withIncompatibleColor(MurkaColor(DISABLED_PARAM)); // Use disabled color for incompatible formats
    // Defer drawing the list until after the button

    // --- Output Filter Button ---
    float outputFilterButtonY = 40 + listHeight + 5; // Position below the list area
    auto& outputFilterButton = m.prepare<M1DropdownButton>(murka::MurkaShape(2 * getWidth() / 3 + 20, outputFilterButtonY, filterButtonWidth, filterButtonHeight));
    outputFilterButton.withLabel(showExactOutputState ? "Filter: ==" : "Filter: <=")
                      .withFontSize(DEFAULT_FONT_SIZE - 5)
                      .withLabelColor(MurkaColor(ENABLED_PARAM)) // Corrected color arg
                      .withOutlineColor(MurkaColor(ENABLED_PARAM)) // Corrected color arg
                      .withOutline(true);
    outputFilterButton.draw();

    if (outputFilterButton) { // Check if pressed
        auto* param = audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramShowExactOutputChannels);
        param->setValueNotifyingHost(!showExactOutputState); // Toggle the value
    }

    // Now draw the output list
    outputList.draw();

    if (outputList.changed) {
        // Only update if the selected format is compatible
        if (std::find(compatibleOutputFormats.begin(), compatibleOutputFormats.end(), 
                     outputFormatsList[outputList.selectedIndex]) != compatibleOutputFormats.end()) {
            selectedOutputFormatIndex = outputList.selectedIndex;
            auto* paramOutputMode = dynamic_cast<juce::AudioParameterInt*>(audioProcessor.parameters.getParameter(M1TranscoderAudioProcessor::paramOutputMode));
            if (paramOutputMode) {
                *paramOutputMode = selectedOutputFormatIndex;
            }
        } else {
            // Show error for incompatible format
            audioProcessor.showErrorPopup = true;
            audioProcessor.errorMessage = "INCOMPATIBLE FORMAT";
            audioProcessor.errorMessageInfo = "The selected output format is not compatible with the current input format.";
            audioProcessor.errorStartTime = std::chrono::steady_clock::now();
            audioProcessor.errorOpacity = 1.0f;
        }
    }
    
    // Get current format names for labels
    std::string inputFormatName = audioProcessor.getTranscodeInputFormat();
    std::string outputFormatName = audioProcessor.getTranscodeOutputFormat();
    
    // Draw format labels above the meter sections
    m.setColor(ENABLED_PARAM);
    m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, DEFAULT_FONT_SIZE - 4);
    
    // Input format label
    auto& currentInputFormatLabel = m.prepare<murka::Label>(murka::MurkaShape(getWidth() / 3 + 10, getHeight() / 2 - 40, getWidth() / 6 - 20, 20));
    currentInputFormatLabel.label = inputFormatName;
    currentInputFormatLabel.alignment = TextAlignment::TEXT_CENTER;
    currentInputFormatLabel.draw();
    
    // Output format label
    auto& currentOutputFormatLabel = m.prepare<murka::Label>(murka::MurkaShape(getWidth() / 2 + 10, getHeight() / 2 - 40, getWidth() / 6 - 20, 20));
    currentOutputFormatLabel.label = outputFormatName;
    currentOutputFormatLabel.alignment = TextAlignment::TEXT_CENTER;
    currentOutputFormatLabel.draw();
    
    // Draw channel meters in the center
    drawChannelMeters();
    
    // Draw arrow in the center
    m.setColor(ENABLED_PARAM);
    drawArrow(getWidth() / 2 - 5, getHeight() / 2, getWidth() / 2 + 5, getHeight() / 2, 5);
    
    /// Transcoder label
    m.setColor(ENABLED_PARAM);
    m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, DEFAULT_FONT_SIZE - 5);
    int labelYOffset = 26;
    auto& transcoderLabel = m.prepare<M1Label>(MurkaShape(m.getSize().width() - 100, m.getSize().height() - labelYOffset, 80, 20));

    transcoderLabel.label = "TRANSCODER";
    transcoderLabel.alignment = TEXT_CENTER;
    transcoderLabel.enabled = false;
    transcoderLabel.highlighted = false;
    transcoderLabel.draw();

    m.setColor(ENABLED_PARAM);
    m.drawImage(m1logo, 25, m.getSize().height() - labelYOffset, 161 / 4, 39 / 4);
    
    // Draw the alert if active
    if (hasActiveAlert)
    {
        auto& alertModal = m.prepare<M1AlertComponent>(MurkaShape(30, 0, 400, 310)); // center of yaw dial
        alertModal.alertActive = murkaAlert.alertActive;
        alertModal.alert = murkaAlert.alert;
        alertModal.alertWidth = 400;
        alertModal.alertHeight = 250;
        alertModal.onDismiss = [this]()
        {
            murkaAlert.alertActive = false;
            hasActiveAlert = false;
        };
        alertModal.draw();
    }
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
    
    // Make sure we have level data and mute states
    if (audioProcessor.inputChannelLevels.size() < inputChannels) {
        audioProcessor.inputChannelLevels.resize(inputChannels, 0.0f);
    }
    if (audioProcessor.outputChannelLevels.size() < outputChannels) {
        audioProcessor.outputChannelLevels.resize(outputChannels, 0.0f);
    }
    if (audioProcessor.inputChannelMutes.size() < inputChannels) {
        audioProcessor.inputChannelMutes.resize(inputChannels, false);
    }
    if (audioProcessor.outputChannelMutes.size() < outputChannels) {
        audioProcessor.outputChannelMutes.resize(outputChannels, false);
    }
    
    // Calculate grid layout for input meters - make them smaller
    int inputCols = std::min(4, inputChannels);
    int inputRows = (inputChannels + inputCols - 1) / inputCols; // Ceiling division
    float inputMeterSize = 8.0f;
    float inputSpacing = 5.0f;
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
            .withChannelNumber(i, false)
            .withMuted(audioProcessor.inputChannelMutes[i])
            .asInput(true);
        meter.draw();
        
        // Check if meter was clicked to toggle mute
        if (meter) {
            audioProcessor.inputChannelMutes[i] = meter.muted;
        }
    }
    
    // Calculate grid layout for output meters - make them smaller
    int outputCols = std::min(4, outputChannels);
    int outputRows = (outputChannels + outputCols - 1) / outputCols; // Ceiling division
    float outputMeterSize = 8.0f;
    float outputSpacing = 5.0f;
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
            .withChannelNumber(i, false)
            .withMuted(audioProcessor.outputChannelMutes[i])
            .asInput(false);
        meter.draw();
        
        // Check if meter was clicked to toggle mute
        if (meter) {
            audioProcessor.outputChannelMutes[i] = meter.muted;
        }
    }
}

void MainComponent::updateFormatLists() {
    // Get current channel counts
    int numHostInputChannels = audioProcessor.getBus(true, 0)->getNumberOfChannels();
    int numHostOutputChannels = audioProcessor.getBus(false, 0)->getNumberOfChannels();
    
    // --- Update Input List --- 
    inputFormatsList = audioProcessor.getMatchingInputFormatNames(numHostInputChannels);
    
    // Find the index of the currently selected format name in the new list
    auto it_in = std::find(inputFormatsList.begin(), inputFormatsList.end(), audioProcessor.selectedInputFormatName);
    if (it_in != inputFormatsList.end()) {
        // Found it, update the index
        audioProcessor.selectedInputFormatIndex = static_cast<int>(std::distance(inputFormatsList.begin(), it_in));
    } else {
        // Not found (or was empty), reset to the first item if available
        if (!inputFormatsList.empty()) {
            audioProcessor.selectedInputFormatIndex = 0;
            // Update the processor's selected name to match the reset
            audioProcessor.setTranscodeInputFormat(inputFormatsList[0]); 
        } else {
            // No formats available
            audioProcessor.selectedInputFormatIndex = 0;
            audioProcessor.setTranscodeInputFormat(""); 
        }
    }

    // --- Update Output List --- 
    std::string currentSelectedInputFormat = audioProcessor.getTranscodeInputFormat(); // Use the potentially updated name
    if (!currentSelectedInputFormat.empty()) {
        // Get the full list based *only* on channel filtering (fast)
        outputFormatsList = audioProcessor.getMatchingOutputFormatNames(numHostOutputChannels);
        // Get the list of *actually compatible* formats (slower)
        compatibleOutputFormats = audioProcessor.getCompatibleOutputFormats(currentSelectedInputFormat, numHostOutputChannels);
    } else {
        outputFormatsList.clear();
        compatibleOutputFormats.clear();
    }
    
    // --- Output Selection Logic --- 
    int newOutputIndex = -1;
    std::string newOutputName = "";

    // Prioritize finding the previously selected format *within the compatible list*
    auto it_compat = std::find(compatibleOutputFormats.begin(), compatibleOutputFormats.end(), audioProcessor.selectedOutputFormatName);

    if (it_compat != compatibleOutputFormats.end()) {
        // Found the previously selected format and it's still compatible
        newOutputName = *it_compat;
    } else {
        // Previous selection not found or no longer compatible.
        // Select the first compatible format if any exist.
        if (!compatibleOutputFormats.empty()) {
            newOutputName = compatibleOutputFormats[0];
        } else {
            // No compatible formats exist for this input/channel count/filter
            newOutputName = "";
        }
    }

    // Now find the index of the chosen name in the *full* list for UI display
    if (!newOutputName.empty()) {
         auto it_full = std::find(outputFormatsList.begin(), outputFormatsList.end(), newOutputName);
         if (it_full != outputFormatsList.end()) {
             newOutputIndex = static_cast<int>(std::distance(outputFormatsList.begin(), it_full));
         } else {
             // Should not happen if compatible list is derived from full list, but handle defensively
             newOutputIndex = 0; 
             newOutputName = ""; // Clear name if index is invalid
         }
    } else {
        // No compatible format was chosen
        newOutputIndex = 0;
    }
    
    // Update processor state if the selection changed
    if (newOutputName != audioProcessor.selectedOutputFormatName) {
         audioProcessor.setTranscodeOutputFormat(newOutputName);
    }
    // Always update the index for the UI list
    audioProcessor.selectedOutputFormatIndex = newOutputIndex;
} 

void MainComponent::postAlert(const Mach1::AlertData& alert)
{
    currentAlert = alert;
    murkaAlert.alertActive = true;
    murkaAlert.alert.title = currentAlert.title;
    murkaAlert.alert.message = currentAlert.message;
    murkaAlert.alert.buttonText = currentAlert.buttonText;
    hasActiveAlert = true;
}
