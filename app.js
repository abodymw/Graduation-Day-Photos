const MAX_FILE_BYTES = 30 * 1024 * 1024; // keep in sync with Storage Rules

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const chooseBtn = document.getElementById("chooseBtn");
const uploadList = document.getElementById("uploadList");
const gallery = document.getElementById("gallery");
const emptyState = document.getElementById("emptyState");
const photoCount = document.getElementById("photoCount");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const toastEl = document.getElementById("toast");

let galleryItems = []; // {name, url, originalName, size, timeCreated}

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
  if (e.target === chooseBtn) return;
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
  downloadAllBtn.disabled = galleryItems.length === 0;

  gallery.querySelectorAll(".photo-tile").forEach((el) => el.remove());

  const frag = document.createDocumentFragment();
  galleryItems.forEach((item) => {
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.innerHTML = `
      <img src="${item.url}" alt="${item.originalName}" loading="lazy">
      <div class="tile-actions">
        <button class="download-btn" title="Download original">⬇</button>
      </div>
    `;
    const img = tile.querySelector("img");
    img.addEventListener("click", () => window.open(item.url, "_blank"));
    img.addEventListener("error", () => {
      tile.innerHTML = `
        <div class="fallback">
          <span>📷</span>
          <span>${item.originalName}</span>
          <span>(preview unavailable)</span>
        </div>
        <div class="tile-actions">
          <button class="download-btn" title="Download original">⬇</button>
        </div>
      `;
      tile.querySelector(".download-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        downloadOriginal(item);
      });
    });
    tile.querySelector(".download-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadOriginal(item);
    });
    frag.appendChild(tile);
  });
  gallery.appendChild(frag);
}

async function downloadOriginal(item) {
  try {
    showToast(`Downloading "${item.originalName}"...`);
    const res = await fetch(item.url);
    const blob = await res.blob();
    saveAs(blob, item.originalName);
  } catch (err) {
    showToast(`Couldn't download "${item.originalName}": ${err.message}`, true);
  }
}

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

downloadAllBtn.addEventListener("click", async () => {
  if (!galleryItems.length) return;
  downloadAllBtn.disabled = true;
  const originalLabel = downloadAllBtn.textContent;
  const zip = new JSZip();
  const usedNames = new Set();

  try {
    for (let i = 0; i < galleryItems.length; i++) {
      const item = galleryItems[i];
      downloadAllBtn.textContent = `Zipping ${i + 1}/${galleryItems.length}...`;
      const res = await fetch(item.url);
      const blob = await res.blob();
      let name = item.originalName;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf(".");
        name = dot > -1 ? `${name.slice(0, dot)}_${i}${name.slice(dot)}` : `${name}_${i}`;
      }
      usedNames.add(name);
      zip.file(name, blob, { compression: "STORE" }); // no re-compression, exact original bytes
    }
    downloadAllBtn.textContent = "Building zip...";
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "graduation-photos.zip");
  } catch (err) {
    showToast(`Download all failed: ${err.message}`, true);
  } finally {
    downloadAllBtn.textContent = originalLabel;
    downloadAllBtn.disabled = false;
  }
});

// ---------- Init ----------

loadGallery();
setInterval(loadGallery, 30000); // pick up photos other guests added
