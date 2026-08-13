# m1-transcoder

Frontend Mach1 Transcode application that utilizes m1-transcode and other dependencies to prepare multichannel audio/video deliverables

### Installation

First prepare your electron development environment:

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. From your command line:

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

# package macOS app
npm run package-mac
# package windows app
npm run package-win
```

### Batch conversion

Open **File → Batch Convert…** to add one row per dropped input, set per-row formats and
destinations, attach optional stereo/JSON/video assets, and save or load versioned JSON
manifests. Outputs default to the input folder with the selected format appended to the
source name. The batch runner processes rows sequentially, continues after a row failure,
and refuses collisions unless overwrite is explicitly selected. The **Output Layout**
column selects a single interleaved multichannel file or one numbered mono file per
channel. Multi-mono output requires uncompressed WAV or AIF and publishes files with
`_01`, `_02`, and subsequent channel suffixes. JSON manifests use
`output.layout: "multichannel"` or `"multi-mono"`.

The same manifest can run without the UI:

```bash
npm run batch -- --batch examples/batch-m1spatial-8-to-4.json \
  --report /tmp/transcoder-report.json

# Validate and print resolved recipes without rendering
npm run batch -- --batch batch.json --dry-run

# Packaged application
"/Applications/M1-Transcoder.app/Contents/MacOS/M1-Transcoder" \
  --batch batch.json --report report.csv --overwrite
```

Options:

- `--batch <manifest>` selects the versioned manifest.
- `--report <json-or-csv>` saves the aggregate gain/loudness report.
- `--dry-run` validates inputs, probes media, and prints resolved plans.
- `--overwrite` permits replacing existing outputs.
- `--no-analysis` skips before/after measurements.

Exit codes are deterministic: `0` success, `1` usage/manifest error, `2` missing
dependency, `3` one or more failed jobs, and `4` cancellation. See
[`schemas/batch-manifest-v1.schema.json`](schemas/batch-manifest-v1.schema.json) and
[`examples/batch-m1spatial-8-to-4.json`](examples/batch-m1spatial-8-to-4.json).

For gain-preserving Mach1Spatial-8 to Mach1Spatial-4 renders, use explicit
`"proToolsOrder": "pro-tools-8"` when applicable. The shared path runs the
Mach1Spatial-8 to Mach1Spatial-4 matrix through Mach1 Transcode, applies a fixed
-3.0103 dB API master-gain compensation, and does not normalize. The compensation
turns the API's constant-power 0.7071 coefficients into gain-matched 0.5 vertical-pair
coefficients so the four-channel result retains headroom. It preserves source sample
rate and PCM depth and reports native per-channel peak/RMS plus a versioned
M1Horizon-to-stereo LUFS/LRA/dBTP comparison.
