import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new Database(config.dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    size INTEGER NOT NULL,
    password_hash TEXT,
    encrypted INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    max_downloads INTEGER,
    downloads INTEGER NOT NULL DEFAULT 0,
    burn_after_download INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);
`);

export function createShare(share) {
  db.prepare(`
    INSERT INTO shares (
      id, original_name, stored_name, mime_type, size,
      password_hash, encrypted, expires_at, max_downloads,
      burn_after_download, created_at
    )
    VALUES (
      @id, @originalName, @storedName, @mimeType, @size,
      @passwordHash, @encrypted, @expiresAt, @maxDownloads,
      @burnAfterDownload, @createdAt
    )
  `).run(share);
}

export function getShare(id) {
  return db.prepare("SELECT * FROM shares WHERE id = ?").get(id);
}

export function incrementDownloads(id) {
  return db.prepare(`
    UPDATE shares
    SET downloads = downloads + 1
    WHERE id = ?
  `).run(id);
}

export function deleteShare(id) {
  return db.prepare("DELETE FROM shares WHERE id = ?").run(id);
}

export function expiredShares(now = new Date().toISOString()) {
  return db.prepare(`
    SELECT * FROM shares
    WHERE expires_at <= ?
  `).all(now);
}

export function removeExpiredShares(now = new Date().toISOString()) {
  const rows = expiredShares(now);
  const remove = db.prepare("DELETE FROM shares WHERE id = ?");
  const transaction = db.transaction((items) => {
    for (const item of items) remove.run(item.id);
  });
  transaction(rows);
  return rows;
}
