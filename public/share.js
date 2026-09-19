const $ = (id) => document.getElementById(id);
const id = location.pathname.split("/").filter(Boolean).pop();

let share;
let encryptionKey = new URLSearchParams(location.hash.slice(1)).get("key");

function base64UrlToBytes(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

async function load() {
  try {
    const response = await fetch(`/api/shares/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("This share has expired or does not exist.");

    share = await response.json();

    $("loading").classList.add("hidden");
    $("shareCard").classList.remove("hidden");
    $("fileName").textContent = share.name;
    $("fileMeta").textContent =
      `${formatSize(share.size)} · ${share.encrypted ? "browser encrypted" : "server stored"} · ` +
      `${share.maxDownloads ? `${share.maxDownloads} download${share.maxDownloads === 1 ? "" : "s"} max` : "unlimited downloads"}`;

    if (share.passwordProtected) {
      $("passwordBox").classList.remove("hidden");
    }
  } catch (error) {
    $("loading").innerHTML = `
      <p class="eyebrow">UNAVAILABLE</p>
      <h1>${error.message}</h1>
      <p class="lead">The owner may have deleted it, or the link may have reached its limit.</p>
    `;
  }
}

async function decryptDownload(response) {
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (new TextDecoder().decode(bytes.slice(0, 3)) !== "SC1") {
    throw new Error("Encrypted file header is invalid.");
  }

  const iv = bytes.slice(3, 15);
  const encryptedData = bytes.slice(15);
  const rawKey = base64UrlToBytes(encryptionKey);

  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  return new Blob([
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData)
  ]);
}

async function download() {
  $("downloadButton").disabled = true;
  $("shareStatus").textContent = "Preparing download…";

  try {
    const headers = {};
    if (share.passwordProtected) {
      headers["X-SendCrate-Password"] = $("downloadPassword").value;
    }

    const response = await fetch(`/api/shares/${encodeURIComponent(id)}/download`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Download failed.");
    }

    const blob = share.encrypted ? await decryptDownload(response) : await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = share.name.replace(/\.sc1$/, "");
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    $("shareStatus").textContent = "Download started.";
  } catch (error) {
    $("shareStatus").textContent = error.message;
  } finally {
    $("downloadButton").disabled = false;
  }
}

$("downloadButton").addEventListener("click", download);

$("qrButton").addEventListener("click", async () => {
  const response = await fetch(`/api/shares/${encodeURIComponent(id)}/qr`);
  if (!response.ok) return;
  $("qr").src = URL.createObjectURL(await response.blob());
  $("qr").classList.toggle("hidden");
});

load();
