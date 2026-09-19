import crypto from "node:crypto";

export function makeId(bytes = 10) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password, "utf8").digest("hex");
}

export function parseDuration(value, defaultHours = 24) {
  if (!value) return defaultHours * 60 * 60 * 1000;

  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(m|h|d)$/i);
  if (!match) throw new Error("Invalid duration. Use values like 30m, 2h or 7d.");

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;

  const milliseconds = amount * multiplier;
  const max = 30 * 86_400_000;

  if (milliseconds <= 0 || milliseconds > max) {
    throw new Error("Expiry must be between 1 minute and 30 days.");
  }

  return milliseconds;
}

export function safeFileName(name) {
  const clean = String(name || "download")
    .replace(/[^\w.\- ()]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();

  return clean || "download";
}
