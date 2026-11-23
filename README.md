# AI to SVG converter

Converts Adobe Illustrator (`.ai`) files to SVG, one SVG per artboard.
Use it from a web page in your browser, or from the command line.

## Software requirements

| Software | Version | Needed for | Download |
|---|---|---|---|
| Node.js | 18 or newer (tested on 24) | Always | https://nodejs.org (LTS version) |
| npm | Comes with Node.js | Installing dependencies | — |
| Ghostscript | 10.x (tested on 10.08) | Only for old-format, PostScript-based `.ai` files | https://github.com/ArtifexSoftware/ghostpdl-downloads/releases (Windows: `gsXXXXXw64.exe`) |
| A web browser | Any modern browser (Chrome, Edge, Firefox) | The web page | — |

- **OS:** Windows 10/11 is the main target. The converter also runs on macOS and Linux, but the **Browse…** folder button is Windows-only (type the folder path instead).
- **Node package:** `mupdf` (installed by `npm install`).
- Ghostscript is found automatically if it is on your PATH or installed in `C:\Program Files\gs`.

## Setup (one time)

1. Install Node.js from https://nodejs.org. Check it worked:
   ```
   node --version
   ```
2. (Optional) Install Ghostscript if you have old-format `.ai` files.
3. Open a terminal in this folder and install dependencies:
   ```
   cd C:\Users\shaik\Downloads\ai2svg-js
   npm install
   ```

## Run the web app

1. Start the server:
   ```
   npm start
   ```
   You should see `ai2svg UI running at http://localhost:4000`.
2. Open **http://localhost:4000** in your browser.
3. Drag `.ai` files onto the box, or click it to choose files.
4. Choose where to save: it defaults to your **Downloads** folder. Click **Browse…** or type a full path to change it.
5. **Keep text editable** is ticked by default. Untick it to turn text into shapes so it looks identical everywhere, even without the font.
6. Click **Convert**. Each file shows where its SVGs were saved.
7. To stop the server, press **Ctrl+C** in the terminal.

To use a different port: `set PORT=5000 && npm start` (Command Prompt) or `$env:PORT=5000; npm start` (PowerShell).

## Run from the command line

```
node ai2svg.mjs <input.ai> [output-folder] [--keep-text]
```

Examples:
```
node ai2svg.mjs logo.ai
node ai2svg.mjs "C:\Designs\logo.ai" out --keep-text
```

On the command line, text becomes shapes unless you add `--keep-text`.

## Output

- `logo.ai` with one artboard gives `logo.svg`.
- With several artboards: `logo-1.svg`, `logo-2.svg`, ...
- Existing files with the same name are overwritten.

## Common errors

| Message | Fix |
|---|---|
| Saved without "Create PDF Compatible File" | Open in Illustrator, Save As `.ai` with **Create PDF Compatible File** ticked. |
| This is a legacy PostScript-based .ai file. Install Ghostscript... | Install Ghostscript (see requirements), restart the server. |
| Ghostscript could not read this legacy .ai file | Very old files (Illustrator 8 and earlier) may not be readable. Re-save from Illustrator or export to PDF from Inkscape. |
| This does not look like a valid .ai file | The file is damaged or not an Illustrator file. |
| Output folder must be a full path | Use a full path like `C:\Users\you\Downloads`. |
| `EADDRINUSE` when starting | The port is in use. Stop the other program or pick another port (see above). |

## Files

- `ai2svg.mjs`: the converter (command line and shared code)
- `server.mjs`: local web server, only reachable from this computer
- `ui.html`: the web page
