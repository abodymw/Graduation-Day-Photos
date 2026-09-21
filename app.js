const MAX_FILE_BYTES = 30 * 1024 * 1024; // keep in sync with Storage Rules

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const chooseBtn = document.getElementById("chooseBtn");
const driveBtn = document.getElementById("driveBtn");
const uploadList = document.getElementById("uploadList");
const gallery = document.getElementById("gallery");
const emptyState = document.getElementById("emptyState");
const photoCount = document.getElementById("photoCount");
const downloadPreviewBg = document.getElementById("downloadPreviewBg");
const photoPicker = document.getElementById("photoPicker");
const downloadPhotosBtn = document.getElementById("downloadPhotosBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const selectedCountEl = document.getElementById("selectedCount");
const toastEl = document.getElementById("toast");

let galleryItems = []; // {name, url, originalName, size, timeCreated}
const selectedNames = new Set();

function showToast(message, isError) {
  toastEl.textContent = message;
  toastEl.classList.toggle("error", !!isError);
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 4000);
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function uniqueStorageName(originalName) {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}_${rand}_${sanitizeName(originalName)}`;
}

// ---------- Upload ----------

chooseBtn.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("click", (e) => {
  if (e.target === chooseBtn || e.target === driveBtn) return;
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  handleFiles(e.dataTransfer.files);
});

// ---------- Google Drive import ----------

let driveAccessToken = null;
let driveTokenClient = null;

function ensureDriveTokenClient() {
  if (driveTokenClient) return driveTokenClient;
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_DRIVE_SCOPE,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        showToast(`Google Drive sign-in failed: ${tokenResponse.error}`, true);
        return;
      }
      driveAccessToken = tokenResponse.access_token;
      openDrivePicker();
    },
  });
  return driveTokenClient;
}

driveBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  ensureDriveTokenClient();
  if (driveAccessToken) {
    openDrivePicker();
  } else {
    driveTokenClient.requestAccessToken({ prompt: "" });
  }
});

function openDrivePicker() {
  gapi.load("picker", () => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(driveAccessToken)
      .setDeveloperKey(GOOGLE_API_KEY)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback(handleDrivePicked)
      .build();
    picker.setVisible(true);
  });
}

function handleDrivePicked(data) {
  if (data.action !== google.picker.Action.PICKED) return;
  data.docs.forEach(importDriveFile);
}

async function importDriveFile(doc) {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
      headers: { Authorization: `Bearer ${driveAccessToken}` },
    });
    if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
    const blob = await res.blob();
    const file = new File([blob], doc.name, { type: doc.mimeType || blob.type || "image/jpeg" });
    uploadFile(file);
  } catch (err) {
    showToast(`Couldn't import "${doc.name}" from Drive: ${err.message}`, true);
  }
}

function handleFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  if (files.length === 0) {
    showToast("Please choose image files only.", true);
    return;
  }
  files.forEach(uploadFile);
}

function uploadFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`"${file.name}" is too large (max ${formatBytes(MAX_FILE_BYTES)}).`, true);
    return;
  }

  const storageName = uniqueStorageName(file.name);
  const row = document.createElement("div");
  row.className = "upload-item";
  row.innerHTML = `
    <div class="upload-item-name">
      <span>${file.name}</span>
      <span class="upload-pct">0%</span>
    </div>
    <div class="progress-track"><div class="progress-fill"></div></div>
  `;
  uploadList.appendChild(row);
  const fill = row.querySelector(".progress-fill");
  const pctLabel = row.querySelector(".upload-pct");

  const metadata = {
    contentType: file.type || "application/octet-stream",
    customMetadata: { originalName: file.name },
  };

  const task = photosRef.child(storageName).put(file, metadata);

  task.on(
    "state_changed",
    (snap) => {
      const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      fill.style.width = pct + "%";
      pctLabel.textContent = pct + "%";
    },
    (err) => {
      fill.classList.add("error");
      pctLabel.textContent = "failed";
      showToast(`Upload failed for "${file.name}": ${err.message}`, true);
    },
    async () => {
      fill.classList.add("done");
      pctLabel.textContent = "done";
      setTimeout(() => row.remove(), 2500);
      const url = await task.snapshot.ref.getDownloadURL();
      addGalleryItem({
        name: storageName,
        url,
        originalName: file.name,
        size: file.size,
        timeCreated: new Date().toISOString(),
      });
    }
  );
}

// ---------- Gallery ----------

function addGalleryItem(item) {
  galleryItems.unshift(item);
  renderGallery();
}

function renderGallery() {
  emptyState.style.display = galleryItems.length ? "none" : "block";
  photoCount.textContent = galleryItems.length ? `(${galleryItems.length})` : "";

  gallery.querySelectorAll(".photo-tile").forEach((el) => el.remove());

  const frag = document.createDocumentFragment();
  galleryItems.forEach((item) => {
    const tile = document.createElement("div");
    tile.className = "photo-tile" + (selectedNames.has(item.name) ? " selected" : "");
    tile.dataset.name = item.name;
    tile.innerHTML = `
      <label class="select-check">
        <input type="checkbox" ${selectedNames.has(item.name) ? "checked" : ""}>
      </label>
      <img src="${item.url}" alt="${item.originalName}" loading="lazy">
      <div class="tile-actions">
        <button class="download-btn" title="Download original">⬇</button>
      </div>
    `;
    const img = tile.querySelector("img");
    const checkbox = tile.querySelector("input");

    img.addEventListener("click", () => window.open(item.url, "_blank"));
    img.addEventListener("error", () => {
      img.replaceWith(
        Object.assign(document.createElement("div"), {
          className: "fallback",
          innerHTML: `<span>📷</span><span>${item.originalName}</span><span>(preview unavailable)</span>`,
        })
      );
    });

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedNames.add(item.name);
        tile.classList.add("selected");
      } else {
        selectedNames.delete(item.name);
        tile.classList.remove("selected");
      }
      updateSelectionUI();
    });

    tile.querySelector(".download-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadItems([item]);
    });

    frag.appendChild(tile);
  });
  gallery.appendChild(frag);
  updateSelectionUI();
  renderDownloadPreviewBg();
}

function renderDownloadPreviewBg() {
  if (!galleryItems.length) {
    downloadPreviewBg.style.animation = "none";
    downloadPreviewBg.innerHTML = "";
    return;
  }
  // Duplicate the list so the scrolling loop is seamless.
  const doubled = galleryItems.concat(galleryItems);
  downloadPreviewBg.innerHTML = doubled
    .map((item) => `<img src="${item.url}" alt="" loading="lazy">`)
    .join("");
  const durationSeconds = Math.max(galleryItems.length * 4, 14);
  downloadPreviewBg.style.animation = `preview-scroll ${durationSeconds}s linear infinite`;
}

downloadPhotosBtn.addEventListener("click", () => {
  const opening = photoPicker.hidden;
  photoPicker.hidden = !opening;
  downloadPhotosBtn.textContent = opening ? "Hide Photos" : "Download Photos";
  if (opening) {
    photoPicker.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

function updateSelectionUI() {
  const n = selectedNames.size;
  downloadSelectedBtn.disabled = n === 0;
  selectedCountEl.textContent = n ? `(${n})` : "";
}

selectAllBtn.addEventListener("click", () => {
  galleryItems.forEach((item) => selectedNames.add(item.name));
  renderGallery();
});

clearSelectionBtn.addEventListener("click", () => {
  selectedNames.clear();
  renderGallery();
});

downloadSelectedBtn.addEventListener("click", () => {
  const items = galleryItems.filter((item) => selectedNames.has(item.name));
  downloadItems(items);
});

async function loadGallery() {
  try {
    const listing = await photosRef.listAll();
    const items = await Promise.all(
      listing.items.map(async (itemRef) => {
        const [url, metadata] = await Promise.all([
          itemRef.getDownloadURL(),
          itemRef.getMetadata(),
        ]);
        return {
          name: itemRef.name,
          url,
          originalName: (metadata.customMetadata && metadata.customMetadata.originalName) || itemRef.name,
          size: metadata.size,
          timeCreated: metadata.timeCreated,
        };
      })
    );
    items.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));
    galleryItems = items;
    renderGallery();
  } catch (err) {
    showToast(`Couldn't load gallery: ${err.message}`, true);
  }
}

// ---------- Download (straight to device, not zipped) ----------

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadItems(items) {
  if (!items.length) return;
  try {
    showToast(
      items.length === 1
        ? `Preparing "${items[0].originalName}"...`
        : `Preparing ${items.length} photos...`
    );

    const files = await Promise.all(
      items.map(async (item) => {
        const res = await fetch(item.url);
        const blob = await res.blob();
        return new File([blob], item.originalName, { type: blob.type || "image/jpeg" });
      })
    );

    // On phones, Web Share lets people save straight into their Photos/gallery app.
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return;
      } catch (shareErr) {
        if (shareErr.name === "AbortError") return; // user cancelled the share sheet
        // otherwise fall through to plain downloads below
      }
    }

    // Desktop / unsupported browsers: trigger normal downloads to local storage,
    // spaced out slightly so the browser doesn't block them as a popup burst.
    files.forEach((file, i) => {
      setTimeout(() => triggerBrowserDownload(file, file.name), i * 350);
    });
  } catch (err) {
    showToast(`Download failed: ${err.message}`, true);
  }
}

// ---------- Init ----------

loadGallery();
setInterval(loadGallery, 30000); // pick up photos other guests added
