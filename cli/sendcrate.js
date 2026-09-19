#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const command = args.shift();

if (command !== "send") {
  console.log(`
SendCrate CLI

Usage:
  sendcrate send <file> [options]

Options:
  --expires 2h
  --downloads 3
  --password "secret"
  --burn
  --encrypt
  --server https://share.example.com
`);
  process.exit(command ? 1 : 0);
}

const filePath = args.shift();

if (!filePath || !fs.existsSync(filePath)) {
  console.error("File not found.");
  process.exit(1);
}

const serverIndex = args.indexOf("--server");
const server = serverIndex >= 0
  ? args[serverIndex + 1]
  : process.env.SENDCRATE_URL || "http://localhost:3000";

const getOption = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
};

const form = new FormData();
form.append("file", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
form.append("expiresIn", getOption("--expires") || "24h");
form.append("maxDownloads", getOption("--downloads"));
form.append("password", getOption("--password"));
form.append("burnAfterDownload", String(args.includes("--burn")));
form.append("encrypted", String(args.includes("--encrypt")));

const response = await fetch(`${server.replace(/\/+$/, "")}/api/shares`, {
  method: "POST",
  body: form
});

const data = await response.json();

if (!response.ok) {
  console.error(data.error || "Upload failed.");
  process.exit(1);
}

console.log(`\n✓ Uploaded ${path.basename(filePath)}`);
console.log(`\n${data.url}\n`);
console.log(`Expires: ${data.expiresAt}`);
if (data.maxDownloads) console.log(`Downloads: ${data.maxDownloads}`);
