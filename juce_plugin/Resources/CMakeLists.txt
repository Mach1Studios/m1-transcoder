option(PLUGIN_FONT "Set the plugin's primary text font" "InterRegular.ttf")

set(FOUND_FONT InterRegular)
set(FOUND_FONT_TYPE ttf)
set(DEFAULT_FONT_SIZE 18) # 11 * 1.6
juce_add_binary_data(Resources NAMESPACE BinaryData SOURCES mach1logo.png InterRegular.ttf)

set(PLUGIN_FONT "${FOUND_FONT}.${FOUND_FONT_TYPE}")
target_compile_definitions(${PLUGIN_NAME} PUBLIC PLUGIN_FONT="${PLUGIN_FONT}" LOCAL_FONT=${FOUND_FONT} LOCAL_FONT_TYPE=${FOUND_FONT_TYPE} DEFAULT_FONT_SIZE=${DEFAULT_FONT_SIZE} BINARYDATA_FONT=BinaryData::${FOUND_FONT}_${FOUND_FONT_TYPE} BINARYDATA_FONT_SIZE=BinaryData::${FOUND_FONT}_${FOUND_FONT_TYPE}Size)
message(STATUS "Font: ${PLUGIN_FONT}")
message(STATUS "Font (default) size: ${DEFAULT_FONT_SIZE}")
