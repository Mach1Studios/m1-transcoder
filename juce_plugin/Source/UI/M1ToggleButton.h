#pragma once

#include "MurkaTypes.h"
#include "MurkaContext.h"
#include "MurkaView.h"
#include "MurkaInputEventsRegister.h"
#include "MurkaAssets.h"
#include "MurkaLinearLayoutGenerator.h"
#include "MurkaBasicWidgets.h"

#if !defined(DEFAULT_FONT_SIZE)
#define DEFAULT_FONTSIZE 10
#endif

using namespace murka;

class M1ToggleButton : public murka::View<M1ToggleButton> {
public:
    void internalDraw(Murka & m) {
        if (didntInitialiseYet) {
            animatedData = *((bool*)dataToControl) ? 1.0 : 0.0;
            didntInitialiseYet = false;
        }
        
        float highlight_animation = A(inside() * enabled);
        bool isOn = *((bool*)dataToControl);
        
        m.pushStyle();
        
        // Calculate toggle dimensions
        float toggleWidth = 36;
        float toggleHeight = 20;
        float knobSize = 16;
        float padding = 2;
        
        // Animate the toggle state
        animatedData = A(isOn);
        
        // Draw label first (on the left)
        m.setColor(100 + 110 * enabled + 30 * highlight_animation, 220);
        m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, fontSize);
        m.prepare<murka::Label>({0, toggleHeight / 2 - fontSize / 2, 200, fontSize + 4}).text(label).draw();
        
        // Draw toggle switch (positioned after label with some spacing)
        // Calculate approximate label width based on text
        float labelWidth = label.length() * fontSize * 0.5f; // Rough approximation
        float toggleX = labelWidth + 10;
        float toggleY = (shape.size.y - toggleHeight) / 2;
        
        // Background track - draw as rounded capsule
        m.enableFill();
        float backgroundBrightness = isOn ? (150 + 40 * animatedData) : (60 + 20 * highlight_animation);
        m.setColor(backgroundBrightness, 255); // Full opacity for solid track
        
        // Draw track background as overlapping shapes for smooth appearance
        float radius = toggleHeight / 2;
        
        // Draw the main body first
        m.drawRectangle(toggleX, toggleY, toggleWidth, toggleHeight);
        
        // Then draw circles on top for the rounded ends to smooth them
        m.drawCircle(toggleX + radius, toggleY + radius, radius); // Left cap
        m.drawCircle(toggleX + toggleWidth - radius, toggleY + radius, radius); // Right cap
        
        // Animated knob position
        float knobX = toggleX + padding + (toggleWidth - knobSize - 2 * padding) * animatedData;
        float knobY = toggleY + padding;
        
        // Knob - brighter white for contrast
        m.setColor(240 + 15 * highlight_animation, 255);
        m.drawCircle(knobX + knobSize / 2, knobY + knobSize / 2, knobSize / 2);
        
        m.disableFill();
        m.popStyle();

        // Action
        if ((mouseDownPressed(0)) && (inside()) && enabled) {
            *((bool*)dataToControl) = !*((bool*)dataToControl);
            changed = true;
        }
        else {
            changed = false;
        }

        checked = *((bool*)dataToControl);
    }
    
    float animatedData = 0;
    bool didntInitialiseYet = true;
    bool changed = false;
    bool checked = true;
    std::string label;
    float fontSize = DEFAULT_FONT_SIZE;
    bool* dataToControl = nullptr;
    
    M1ToggleButton & controlling(bool* dataPointer) {
        dataToControl = dataPointer;
        return *this;
    }
    
    M1ToggleButton & withLabel(std::string label_) {
        label = label_;
        return *this;
    }
    
    M1ToggleButton & withFontSize(float fontSize_) {
        fontSize = fontSize_;
        return *this;
    }

    MURKA_PARAMETER(M1ToggleButton, // class name
                    bool, // parameter type
                    enabled, // parameter variable name
                    enable, // setter
                    true // default
    )
};

