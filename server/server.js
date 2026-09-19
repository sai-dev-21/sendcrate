import express from "express";
import helmet from "helmet";
import multer from "multer";
import QRCode from "qrcode";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { config } from "./config.js";
import {
  createShare,
  deleteShare,
  getShare,
  incrementDownloads,
  removeExpiredShares
} from "./db.js";
import { removeStoredFile, saveUpload, storagePath } from "./storage.js";
import { hashPassword, makeId, parseDuration, safeFileName } from "./utils.js";

const app = express();

if (config.trustProxy) app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve("public"), {
  extensions: ["html"]
}));

const upload = multer({
  dest: path.resolve("storage/.tmp"),
  limits: {
    fileSize: config.maxFileSize,
    files: 20
  }
});

function shareUrl(id) {
  return `${config.baseUrl}/s/${encodeURIComponent(id)}`;
}

function parseMaxDownloads(value) {
  if (value === undefined || value === "" || value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) {
    throw new Error("Download limit must be an integer between 1 and 10000.");
  }
  return parsed;
}

function isExpired(share) {
  return new Date(share.expires_at).getTime() <= Date.now();
}

function isExhausted(share) {
  return share.max_downloads !== null && share.downloads >= share.max_downloads;
}

async function destroyShare(share) {
  await removeStoredFile(share.stored_name);
  deleteShare(share.id);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sendcrate" });
});

app.post("/api/shares", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "A file is required." });
  }

  try {
    const expiresIn = parseDuration(req.body.expiresIn, config.defaultExpiryHours);
    const maxDownloads = parseMaxDownloads(req.body.maxDownloads);
    const burnAfterDownload = req.body.burnAfterDownload === "true";
    const encrypted = req.body.encrypted === "true";
    const password = req.body.password?.trim() || null;

    if (burnAfterDownload && maxDownloads !== null && maxDownloads > 1) {
      return res.status(400).json({
        error: "Burn-after-download cannot be combined with a download limit greater than 1."
      });
    }

    const id = makeId(10);
    const storedName = `${id}${path.extname(req.file.originalname).slice(0, 20)}`;
    const expiresAt = new Date(Date.now() + expiresIn).toISOString();

    await saveUpload(req.file, storedName);

    createShare({
      id,
      originalName: safeFileName(req.file.originalname),
      storedName,
      mimeType: req.file.mimetype || "application/octet-stream",
      size: req.file.size,
      passwordHash: password ? hashPassword(password) : null,
      encrypted: encrypted ? 1 : 0,
      expiresAt,
      maxDownloads,
      burnAfterDownload: burnAfterDownload ? 1 : 0,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      id,
      url: shareUrl(id),
      expiresAt,
      maxDownloads,
      encrypted
    });
  } catch (error) {
    try {
      await fs.unlink(req.file.path);
    } catch {}
    return res.status(400).json({ error: error.message || "Upload failed." });
  }
});

app.get("/api/shares/:id", (req, res) => {
  const share = getShare(req.params.id);
  if (!share || isExpired(share) || isExhausted(share)) {
    return res.status(404).json({ error: "Share is unavailable." });
  }

  res.json({
    id: share.id,
    name: share.original_name,
    size: share.size,
    mimeType: share.mime_type,
    encrypted: Boolean(share.encrypted),
    passwordProtected: Boolean(share.password_hash),
    expiresAt: share.expires_at,
    downloads: share.downloads,
    maxDownloads: share.max_downloads,
    burnAfterDownload: Boolean(share.burn_after_download)
  });
});

app.get("/api/shares/:id/qr", async (req, res) => {
  const share = getShare(req.params.id);
  if (!share || isExpired(share) || isExhausted(share)) {
    return res.status(404).json({ error: "Share is unavailable." });
  }

  const png = await QRCode.toBuffer(shareUrl(share.id), {
    width: 480,
    margin: 2,
    errorCorrectionLevel: "M"
  });

  res.type("png").send(png);
});

app.get("/api/shares/:id/download", async (req, res) => {
  const share = getShare(req.params.id);

  if (!share || isExpired(share) || isExhausted(share)) {
    if (share && (isExpired(share) || isExhausted(share))) await destroyShare(share);
    return res.status(404).json({ error: "Share is unavailable." });
  }

  if (share.password_hash) {
    const supplied = req.get("X-SendCrate-Password") || "";
    const suppliedHash = hashPassword(supplied);

    if (!crypto.timingSafeEqual(
      Buffer.from(suppliedHash, "utf8"),
      Buffer.from(share.password_hash, "utf8")
    )) {
      return res.status(401).json({ error: "Incorrect password." });
    }
  }

  const filePath = storagePath(share.stored_name);

  if (!fs.existsSync(filePath)) {
    await destroyShare(share);
    return res.status(404).json({ error: "File no longer exists." });
  }

  incrementDownloads(share.id);

  const shouldBurn = Boolean(share.burn_after_download);
  const currentDownload = share.downloads + 1;

  res.setHeader("Content-Type", share.mime_type || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(share.original_name)}`
  );
  res.setHeader("Cache-Control", "no-store");

  res.download(filePath, share.original_name, async (error) => {
    if (shouldBurn || (share.max_downloads !== null && currentDownload >= share.max_downloads)) {
      try {
        await destroyShare(share);
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }
    }

    if (error && !res.headersSent) {
      res.status(500).json({ error: "Download failed." });
    }
  });
});

app.get("/s/:id", (req, res) => {
  res.sendFile(path.resolve("public/share.html"));
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `File is too large. Maximum is ${Math.round(config.maxFileSize / 1024 / 1024)} MB.`
    });
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

const cleanup = async () => {
  try {
    const expired = removeExpiredShares();
    for (const share of expired) await removeStoredFile(share.stored_name);
    if (expired.length) console.log(`Cleaned ${expired.length} expired share(s).`);
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
};

setInterval(cleanup, 60_000).unref();
await cleanup();

app.listen(config.port, () => {
  console.log(`SendCrate running at ${config.baseUrl}`);
});
