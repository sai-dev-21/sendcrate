const $ = (id) => document.getElementById(id);

const dropzone = $("dropzone");
const fileInput = $("fileInput");
const chooseButton = $("chooseButton");
const fileList = $("fileList");
const uploadButton = $("uploadButton");
const result = $("result");
const status = $("status");
const encrypt = $("encrypt");
const burn = $("burn");

let files = [];

$("limitText").textContent = "Choose one or more files to create a share.";

chooseButton.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("click", (event) => {
  if (event.target === chooseButton) return;
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  files = [...fileInput.files];
  renderFiles();
});

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
}

dropzone.addEventListener("drop", (event) => {
  files = [...event.dataTransfer.files];
  renderFiles();
});

burn.addEventListener("change", () => {
  if (burn.checked) {
    $("downloads").value = "1";
    $("downloads").disabled = true;
  } else {
    $("downloads").disabled = false;
  }
});

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function renderFiles() {
  fileList.innerHTML = files.map((file) => `
    <div class="file-row">
      <div class="file-icon small">↗</div>
      <div>
        <strong>${escapeHtml(file.name)}</strong>
        <span>${formatSize(file.size)}</span>
      </div>
    </div>
  `).join("");

  uploadButton.disabled = files.length === 0;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

async function encryptFile(file) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const rawKey = await crypto.subtle.exportKey("raw", key);

  const blob = new Blob([
    new TextEncoder().encode("SC1"),
    iv,
    new Uint8Array(encrypted)
  ], { type: "application/octet-stream" });

  const keyBytes = new Uint8Array(rawKey);
  const keyText = btoa(String.fromCharCode(...keyBytes))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

  return {
    blob: new File([blob], `${file.name}.sc1`, { type: "application/octet-stream" }),
    keyText
  };
}

async function createShare(file, encrypted) {
  const form = new FormData();
  form.append("file", file);
  form.append("expiresIn", $("expires").value);
  form.append("maxDownloads", $("downloads").value);
  form.append("password", $("password").value);
  form.append("burnAfterDownload", String(burn.checked));
  form.append("encrypted", String(encrypted));

  const response = await fetch("/api/shares", {
    method: "POST",
    body: form
  });

  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Upload failed.");
  return data;
}

uploadButton.addEventListener("click", async () => {
  if (!files.length) return;

  uploadButton.disabled = true;
  result.classList.add("hidden");
  status.textContent = "Uploading…";

  try {
    // The current web interface creates one share per selected file.
    // This keeps download limits and expiry independent.
    const links = [];

    for (const original of files) {
      let uploadFile = original;
      let key = null;

      if (encrypt.checked) {
        const encrypted = await encryptFile(original);
        uploadFile = encrypted.blob;
        key = encrypted.keyText;
      }

      const share = await createShare(uploadFile, encrypt.checked);
      const finalUrl = key ? `${share.url}#key=${key}` : share.url;
      links.push({ name: original.name, url: finalUrl });
    }

    result.innerHTML = `
      <p class="eyebrow">LINK CREATED</p>
      ${links.map((item) => `
        <div class="result-item">
          <strong>${escapeHtml(item.name)}</strong>
          <div class="link-line">
            <input readonly value="${item.url}">
            <button class="secondary copy" data-url="${item.url}">Copy</button>
          </div>
        </div>
      `).join("")}
    `;

    result.classList.remove("hidden");
    status.textContent = "Done. Keep the link if you want to share it.";
    result.querySelectorAll(".copy").forEach((button) => {
      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(button.dataset.url);
        button.textContent = "Copied";
        setTimeout(() => button.textContent = "Copy", 1200);
      });
    });
  } catch (error) {
    status.textContent = error.message;
  } finally {
    uploadButton.disabled = false;
  }
});
