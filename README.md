# m1-transcoder

Frontend Mach1 Transcode application that utilizes m1-transcode and other dependencies to prepare multichannel audio/video deliverables

### Installation

First prepare your electron development environment:

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. From your command line:

- Requires Python 3.10 or less, if you have 3.11 installed please remove it to properly compile (https://stackoverflow.com/questions/74715990/node-gyp-err-invalid-mode-ru-while-trying-to-load-binding-gyp)

- [macOS] Create a .env file in this directory and add the following with the vars filled in properly:
```
APPLEID=
APPLEIDPASS=
APPLE_TEAM_ID=
```

- [unix] Setup
```bash
./scripts/setup.sh # setup the dependencies
```

- [win] Setup
```bash
./scripts/setup.bat # setup the dependencies
```

- Install and build
```bash
cd to_m1transcoder_path
# Install dependencies
npm install

# install Electron Packager for use from cli
npm install electron-packager -g
npm install electron-builder --save-dev

# package macOS app
npm run package-mac
# package windows app
npm run package-win
```