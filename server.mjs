#!/usr/bin/env node
// Local web UI for ai2svg: upload .ai files, save SVGs to Downloads or a chosen folder.
// Usage: node server.mjs   then open http://localhost:4000

import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { convertAiBuffer } from "./ai2svg.mjs";

const PORT = 4000;
const MAX_UPLOAD = 500 * 1024 * 1024;
const DEFAULT_DIR = path.join(os.homedir(), "Downloads");
const PAGE = new URL("./ui.html", import.meta.url);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        reject(new Error("File too large."));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Opens the native Windows folder picker; resolves to the chosen path or "" if cancelled.
function pickFolder() {
  const script =
    "Add-Type -AssemblyName System.Windows.Forms;" +
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog;" +
    "$d.Description = 'Choose where to save the SVG files';" +
    "$f = New-Object System.Windows.Forms.Form -Property @{TopMost=$true};" +
    "if ($d.ShowDialog($f) -eq 'OK') { [Console]::Out.Write($d.SelectedPath) }";
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      (err, stdout) => (err ? reject(err) : resolve(stdout.trim())),
    );
  });
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, await readFile(PAGE), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/default-dir") {
      return send(res, 200, { dir: DEFAULT_DIR });
    }
    if (req.method === "POST" && url.pathname === "/pick-folder") {
      if (process.platform !== "win32")
        return send(res, 501, {
          error: "Folder picker is Windows-only; type a path instead.",
        });
      return send(res, 200, { dir: await pickFolder() });
    }
    if (req.method === "POST" && url.pathname === "/convert") {
      const name = path.parse(
        path.basename(url.searchParams.get("name") || "drawing.ai"),
      ).name;
      const dir = url.searchParams.get("dir") || DEFAULT_DIR;
      if (!path.isAbsolute(dir))
        return send(res, 400, {
          error:
            "Output folder must be a full path, e.g. C:\\Users\\you\\Downloads",
        });
      const keepText = url.searchParams.get("keepText") === "1";
      const data = await readBody(req);
      const files = await convertAiBuffer(data, name, dir, { keepText });
      return send(res, 200, { files });
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
});

// Bind to localhost only: this server writes files to disk and must not be reachable from the network.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`ai2svg UI running at http://localhost:${PORT}`);
});
