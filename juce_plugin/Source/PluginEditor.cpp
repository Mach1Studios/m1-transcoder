#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
M1TranscoderAudioProcessorEditor::M1TranscoderAudioProcessorEditor (M1TranscoderAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{
    // Make the window larger to accommodate all UI elements
    setSize(650, 400);

    // UI component
    mainComponent = new MainComponent(p);
    mainComponent->setSize(getWidth(), getHeight());
    addAndMakeVisible(mainComponent);
}

M1TranscoderAudioProcessorEditor::~M1TranscoderAudioProcessorEditor()
{
    mainComponent->shutdownOpenGL();
    removeAllChildren();
    delete mainComponent;
}

//==============================================================================
void M1TranscoderAudioProcessorEditor::paint (juce::Graphics& g)
{
    // (Our component is opaque, so we must completely fill the background with a solid colour)
    g.fillAll (getLookAndFeel().findColour (juce::ResizableWindow::backgroundColourId));
}

void M1TranscoderAudioProcessorEditor::resized()
{
    // This is called when the editor is resized.
    // Update the bounds of our component
    if (mainComponent != nullptr) {
        mainComponent->setBounds(getLocalBounds());
    }
}
