import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

await fs.mkdir(config.storageDir, { recursive: true });

export async function saveUpload(file, storedName) {
  const destination = path.join(config.storageDir, storedName);
  await fs.rename(file.path, destination);
  return destination;
}

export function storagePath(storedName) {
  return path.join(config.storageDir, storedName);
}

export async function removeStoredFile(storedName) {
  try {
    await fs.unlink(storagePath(storedName));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
