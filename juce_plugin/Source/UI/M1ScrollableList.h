#pragma once

#include "MurkaAssets.h"
#include "MurkaBasicWidgets.h"
#include "MurkaContext.h"
#include "MurkaInputEventsRegister.h"
#include "MurkaLinearLayoutGenerator.h"
#include "MurkaTypes.h"
#include "MurkaView.h"

using namespace murka;

class M1ScrollableList : public murka::View<M1ScrollableList>
{
public:
    void internalDraw(Murka& m)
    {
        // Draw outline border
        m.setColor(outlineColor);
        m.drawRectangle(0, 0, shape.size.x, shape.size.y);
        m.setColor(backgroundColor);
        m.drawRectangle(1, 1, shape.size.x - 2, shape.size.y - 2);

        bool hoveredAnything = false;

        // Scrollbar calculations
        bool drawScrollbar = (options.size() * optionHeight) > shape.size.y;
        if (drawScrollbar)
        {
            maxScrollbarOffset = (options.size() * optionHeight) - shape.size.y;
        }

        int scrollbarWidth = 15;
        float scrollbarHeightRatio = shape.size.y / (options.size() * optionHeight);
        float scrollbarHeight = 15; // Fixed scrollbar height 
        float scrollbarPositionY = (scrollbarOffsetInPixels / maxScrollbarOffset) * (shape.size.y - scrollbarHeight);

        MurkaShape scrollbarShape = MurkaShape(shape.size.x - scrollbarWidth, scrollbarPositionY, scrollbarWidth, scrollbarHeight);
        bool preciseHoveredScrollbar = scrollbarShape.inside(mousePosition());
        bool coarseHoveredScrollbar = (drawScrollbar ? mousePosition().x > shape.size.x - scrollbarWidth : false);

        // Drawing the options
        for (int i = 0; i < options.size(); i++)
        {
            bool hoveredAnOption = (mousePosition().y > i * optionHeight - scrollbarOffsetInPixels) && 
                                  (mousePosition().y < (i + 1) * optionHeight - scrollbarOffsetInPixels) && 
                                  inside();

            hoveredAnOption *= !coarseHoveredScrollbar;
            hoveredAnything |= hoveredAnOption;

            bool isCompatible = compatibleFormats.empty() || 
                               std::find(compatibleFormats.begin(), compatibleFormats.end(), options[i]) != compatibleFormats.end();

            if (hoveredAnOption || i == selectedIndex)
            {
                // Hover option coloring
                MurkaColor colorToUse;
                
                if (hoveredAnOption) {
                    // Hovered item gets highlight color
                    colorToUse = highlightColor;
                    m.setColor(colorToUse);
                    m.drawRectangle(1, i * optionHeight - scrollbarOffsetInPixels, shape.size.x - 2, optionHeight);
                    
                    // Use dark text for hovered items
                    m.setColor(MurkaColor(BACKGROUND_GREY));
                } else if (i == selectedIndex) {
                    // Selected but not hovered - use the special selected color
                    colorToUse = selectedColor;
                    m.setColor(colorToUse);
                    float shrink_offset = 3; // used to shrink selected inset box
                    m.drawRectangle(shrink_offset, i * optionHeight - scrollbarOffsetInPixels + shrink_offset, shape.size.x - shrink_offset*2, optionHeight - shrink_offset*2);
                    
                    // Use normal text color for selected but not hovered
                    m.setColor(textColor);
                }

                if (!isCompatible) {
                    m.setColor(incompatibleColor); // Use disabled color for incompatible formats
                } else if (hoveredAnOption) {
                    m.setColor(MurkaColor(BACKGROUND_GREY)); // Dark text for hovered items
                } else {
                    m.setColor(textColor); // Normal text color
                }

                m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, fontSize);
                juceFontStash::Rectangle label_box = m.getCurrentFont()->getStringBoundingBox(options[i], 0, 0);
                m.prepare<murka::Label>({ labelPadding_x, (optionHeight * i) + optionHeight / 2 - label_box.height / 2 - scrollbarOffsetInPixels, 
                                         shape.size.x - labelPadding_x, optionHeight })
                    .text(options[i])
                    .withAlignment(textAlignment)
                    .draw();

                if (hoveredAnOption && mouseDownPressed(0))
                {
                    if (isCompatible && selectedIndex != i)
                    {
                        selectedIndex = i;
                        changed = true;
                    }
                    else if (!isCompatible)
                    {
                        // Don't change selection for incompatible formats
                        // The click is ignored
                    }
                }
            }
            else
            {
                m.setColor(textColor);
                m.setFontFromRawData(PLUGIN_FONT, BINARYDATA_FONT, BINARYDATA_FONT_SIZE, fontSize);
                juceFontStash::Rectangle label_box = m.getCurrentFont()->getStringBoundingBox(options[i], 0, 0);
                m.prepare<murka::Label>({ labelPadding_x, (optionHeight * i) + optionHeight / 2 - label_box.height / 2 - scrollbarOffsetInPixels, 
                                         shape.size.x - labelPadding_x, optionHeight })
                    .text(options[i])
                    .withAlignment(textAlignment)
                    .draw();
            }
        }

        // Draw scrollbar
        if (drawScrollbar)
        {
            if (preciseHoveredScrollbar)
                m.setColor(ENABLED_PARAM);
            else
                m.setColor(120, 120, 120);
            m.drawRectangle(scrollbarShape);
        }

        if (preciseHoveredScrollbar && mouseDownPressed(0))
        {
            holdingScrollbar = true;
        }

        // Handle scrolling
        if (holdingScrollbar)
        {
            scrollbarOffsetInPixels -= mouseDelta().y * m.getScreenScale();

            if (scrollbarOffsetInPixels > maxScrollbarOffset)
                scrollbarOffsetInPixels = maxScrollbarOffset;
            if (scrollbarOffsetInPixels < 0)
                scrollbarOffsetInPixels = 0;
        }

        if (holdingScrollbar && !mouseDown(0))
        {
            holdingScrollbar = false;
        }
        
        // Handle mouse wheel scrolling
        if (inside() && mouseScroll().y != 0)
        {
            scrollbarOffsetInPixels -= mouseScroll().y * 20;
            
            if (scrollbarOffsetInPixels > maxScrollbarOffset)
                scrollbarOffsetInPixels = maxScrollbarOffset;
            if (scrollbarOffsetInPixels < 0)
                scrollbarOffsetInPixels = 0;
        }
        
        // Reset changed flag after drawing
        if (!mouseDown(0)) {
            changed = false;
        }
    }

    bool holdingScrollbar = false;
    float scrollbarOffsetInPixels = 0;
    float maxScrollbarOffset = 0;

    bool changed = false;
    int selectedIndex = 0;
    std::vector<std::string> options;

    int optionHeight = 30;
    int fontSize = 10;
    float labelPadding_x = 10;
    MurkaColor highlightColor = MurkaColor(ENABLED_PARAM);
    MurkaColor textColor = MurkaColor(LABEL_TEXT_COLOR);
    MurkaColor backgroundColor = MurkaColor(BACKGROUND_GREY);
    MurkaColor outlineColor = MurkaColor(ENABLED_PARAM);
    MurkaColor selectedColor = MurkaColor(80, 80, 80); // Darker grey for selected items
    TextAlignment textAlignment = TEXT_LEFT;

    std::vector<std::string> compatibleFormats;
    MurkaColor incompatibleColor = MurkaColor(DISABLED_PARAM);

    M1ScrollableList& withSelectedIndex(int index)
    {
        selectedIndex = index;
        return *this;
    }

    M1ScrollableList& withHighlightColor(MurkaColor color)
    {
        highlightColor = color;
        return *this;
    }

    M1ScrollableList& withTextColor(MurkaColor color)
    {
        textColor = color;
        return *this;
    }

    M1ScrollableList& withBackgroundColor(MurkaColor color)
    {
        backgroundColor = color;
        return *this;
    }

    M1ScrollableList& withOutlineColor(MurkaColor color)
    {
        outlineColor = color;
        return *this;
    }

    M1ScrollableList& withFontSize(float fontSize_)
    {
        fontSize = fontSize_;
        return *this;
    }

    M1ScrollableList& withOptions(std::vector<std::string> options_)
    {
        options = options_;
        
        // Recalculate scroll bounds and clamp/reset offset
        float totalContentHeight = options.size() * optionHeight;
        if (totalContentHeight <= shape.size.y) {
            maxScrollbarOffset = 0;
            scrollbarOffsetInPixels = 0; // Reset scroll if content now fits
        } else {
            maxScrollbarOffset = totalContentHeight - shape.size.y;
            // Clamp existing offset if it's now out of bounds
            scrollbarOffsetInPixels = std::max(0.0f, std::min(scrollbarOffsetInPixels, maxScrollbarOffset));
        }
        return *this;
    }

    M1ScrollableList& withSelectedColor(MurkaColor color)
    {
        selectedColor = color;
        return *this;
    }

    M1ScrollableList& withCompatibleFormats(const std::vector<std::string>& formats)
    {
        compatibleFormats = formats;
        return *this;
    }

    M1ScrollableList& withIncompatibleColor(MurkaColor color)
    {
        incompatibleColor = color;
        return *this;
    }
}; 
