#!/usr/bin/env node
// Convert an Adobe Illustrator (.ai) file to SVG, one file per artboard/page.
// Usage: node ai2svg.mjs input.ai [outputDir] [--keep-text]
// Setup: npm install mupdf

import { readFile, writeFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as mupdf from "mupdf";

const NO_PDF_MARKER = /saved without PDF Content/i;
const execFileAsync = promisify(execFile);

// Ghostscript is only needed for legacy PostScript-based .ai files.
async function findGhostscript() {
  const names = process.platform === "win32" ? ["gswin64c", "gswin32c", "gs"] : ["gs"];
  for (const name of names) {
    try {
      await execFileAsync(name, ["--version"]);
      return name;
    } catch {}
  }
  if (process.platform === "win32") {
    for (const root of ["C:\\Program Files\\gs", "C:\\Program Files (x86)\\gs"]) {
      const versions = await readdir(root).catch(() => []);
      for (const v of versions.sort().reverse()) {
        for (const exe of ["gswin64c.exe", "gswin32c.exe"]) {
          const candidate = path.join(root, v, "bin", exe);
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  }
  return null;
}

async function postScriptToPdf(data) {
  const gs = await findGhostscript();
  if (!gs) {
    throw new Error(
      "This is a legacy PostScript-based .ai file. Install Ghostscript (winget install ArtifexSoftware.GhostScript) and try again."
    );
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), "ai2svg-"));
  try {
    const input = path.join(dir, "in.ps");
    const output = path.join(dir, "out.pdf");
    await writeFile(input, data);
    try {
      // -dEPSCrop keeps the artwork's bounding box instead of padding it to a full paper page.
      await execFileAsync(gs, ["-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dEPSCrop", "-sDEVICE=pdfwrite", `-sOutputFile=${output}`, input]);
    } catch (err) {
      throw new Error(`Ghostscript could not read this legacy .ai file: ${(err.stderr || err.message).trim().split("\n")[0]}`);
    }
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function convertAiToSvg(inputPath, outputDir, options) {
  const data = await readFile(inputPath);
  return convertAiBuffer(data, path.parse(inputPath).name, outputDir, options);
}

export async function convertAiBuffer(data, baseName, outputDir, { keepText = false } = {}) {
  let header = data.subarray(0, 1024).toString("latin1");

  if (!header.includes("%PDF-") && header.includes("%!PS")) {
    data = await postScriptToPdf(data);
    header = data.subarray(0, 1024).toString("latin1");
  }
  if (!header.includes("%PDF-")) {
    throw new Error("This does not look like a valid .ai file.");
  }

  const doc = mupdf.Document.openDocument(data, "application/pdf");
  const pageCount = doc.countPages();
  const outputs = [];
  await mkdir(outputDir, { recursive: true });

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);

    if (NO_PDF_MARKER.test(page.toStructuredText().asText())) {
      throw new Error(
        'Saved without "Create PDF Compatible File". Re-save it from Illustrator with that option on.'
      );
    }

    const buffer = new mupdf.Buffer();
    const writer = new mupdf.DocumentWriter(buffer, "svg", keepText ? "text=text" : "text=path");
    const device = writer.beginPage(page.getBounds());
    page.run(device, mupdf.Matrix.identity);
    writer.endPage();
    writer.close();

    const suffix = pageCount > 1 ? `-${i + 1}` : "";
    const outputPath = path.join(outputDir, `${baseName}${suffix}.svg`);
    const svg = buffer.asUint8Array();
    const text = new TextDecoder().decode(svg).trim();
    if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/.test(text) || !text.endsWith("</svg>")) {
      throw new Error(`Invalid SVG produced for page ${i + 1}.`);
    }
    await writeFile(outputPath, svg);
    outputs.push(outputPath);
  }
  return outputs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const keepText = args.includes("--keep-text");
  const [input, outputDir = "."] = args.filter((a) => !a.startsWith("--"));

  if (!input) {
    console.error("Usage: node ai2svg.mjs input.ai [outputDir] [--keep-text]");
    process.exit(1);
  }
  try {
    for (const file of await convertAiToSvg(input, outputDir, { keepText })) console.log(file);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
