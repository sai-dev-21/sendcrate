import "dotenv/config";
import path from "node:path";

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: number(process.env.PORT, 3000),
  baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  storageDir: path.resolve(process.env.STORAGE_DIR || "./storage"),
  dbFile: path.resolve(process.env.DB_FILE || "./data/sendcrate.db"),
  maxFileSize: number(process.env.MAX_FILE_SIZE_MB, 512) * 1024 * 1024,
  defaultExpiryHours: number(process.env.DEFAULT_EXPIRY_HOURS, 24),
  adminToken: process.env.ADMIN_TOKEN || "change-this-token",
  trustProxy: process.env.TRUST_PROXY === "true"
};
