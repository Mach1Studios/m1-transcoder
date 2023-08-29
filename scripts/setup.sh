#!/bin/bash

# MACH1 TRANSCODER
# Setup scripting for repo
#
# Note:
#   please run this from the project's parent directory via `./scripts/setup.sh`

# setup and build a portable spatial media injector cli
if [ ! -f app/extraResources/spatialmedia ]
then
	pip3 install pyinstaller
	pyinstaller deps/spatial-media/spatialmedia/__main__.py -n spatialmedia --onefile --distpath app/extraResources
else
	echo "Found spatialmedia dep."
fi

# setup and build a portable m1-transcode cli
# if [ ! -f app/extraResources/m1-transcode ]
# then
# 	cd deps/m1-transcode && sh scripts/setup.sh
# 	cd ../../
# 	cmake deps/m1-transcode -Bdeps/m1-transcode -DCMAKE_OSX_DEPLOYMENT_TARGET=10.9 -DBUILD_PROGRAMS=OFF -DBUILD_EXAMPLES=OFF -DBUILD_TESTING=OFF -DCMAKE_INSTALL_PREFIX=app/extraResources
# 	cmake --build deps/m1-transcode --config Release --target install
# else
# 	echo "Found m1-transcode dep."
# fi