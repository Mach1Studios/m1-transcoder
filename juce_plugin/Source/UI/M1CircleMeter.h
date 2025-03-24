#pragma once

#include "MurkaAssets.h"
#include "MurkaBasicWidgets.h"
#include "MurkaContext.h"
#include "MurkaInputEventsRegister.h"
#include "MurkaLinearLayoutGenerator.h"
#include "MurkaTypes.h"
#include "MurkaView.h"

using namespace murka;

class M1CircleMeter : public murka::View<M1CircleMeter>
{
public:
    void internalDraw(Murka& m)
    {
        // Smooth the level for visual appeal
        smoothedLevel = smoothedLevel * 0.8f + level * 0.2f;
        
        // Draw outer circle (border)
        m.disableFill();
        m.setColor(meterColor);
        m.drawCircle(shape.size.x / 2, shape.size.y / 2, shape.size.x / 2);
        
        // Draw inner circle (level indicator)
        m.enableFill();
        float innerRadius = (shape.size.x / 2) * smoothedLevel;
        
        // Adjust color based on level (green to yellow to red)
        MurkaColor levelColor;
        if (smoothedLevel < 0.5f) {
            // Green to yellow
            float t = smoothedLevel / 0.5f;
            levelColor = MurkaColor(t * 255, 255, 0);
        } else {
            // Yellow to red
            float t = (smoothedLevel - 0.5f) / 0.5f;
            levelColor = MurkaColor(255, (1.0f - t) * 255, 0);
        }
        
        m.setColor(levelColor);
        m.drawCircle(shape.size.x / 2, shape.size.y / 2, innerRadius);
        
        // Draw channel number if enabled
        if (showChannelNumber && channelNumber >= 0) {
            m.setColor(textColor);
            m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, fontSize);
            
            std::string channelText = std::to_string(channelNumber + 1);
            juceFontStash::Rectangle textBounds = m.getCurrentFont()->getStringBoundingBox(channelText, 0, 0);
            
            m.prepare<murka::Label>({ 0, 0, shape.size.x, shape.size.y })
                .text(channelText)
                .withAlignment(TEXT_CENTER)
                .draw();
        }
    }

    float level = 0.0f;
    float smoothedLevel = 0.0f;
    int channelNumber = -1;
    bool showChannelNumber = false;
    MurkaColor meterColor = MurkaColor(ENABLED_PARAM);
    MurkaColor textColor = MurkaColor(LABEL_TEXT_COLOR);
    float fontSize = 10.0f;

    M1CircleMeter& withLevel(float level_)
    {
        level = level_;
        return *this;
    }
    
    M1CircleMeter& withColor(MurkaColor color)
    {
        meterColor = color;
        return *this;
    }
    
    M1CircleMeter& withChannelNumber(int number, bool show = true)
    {
        channelNumber = number;
        showChannelNumber = show;
        return *this;
    }
}; 