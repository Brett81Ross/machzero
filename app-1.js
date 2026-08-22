    const APP_VERSION = "1.4.0";
    const MAX_PHOTOS = 6;
    const DEFAULT_SETTINGS = { feeRate: 13.25, targetMargin: 35, shippingAllowance: 0 };
    const BILLING_FALLBACK = {
      plans: [
        { code: "free", name: "Free", price: 0, scans: 5, type: "free", available: true },
        { code: "flip", name: "Flip", price: 4.99, scans: 40, type: "subscription", available: true },
        { code: "reseller", name: "Reseller", price: 9.99, scans: 150, type: "subscription", recommended: true, available: true },
        { code: "pro", name: "MachZero Pro", price: 19.99, scans: 500, type: "subscription", available: true },
      ],
      credits: [
        { code: "credits10", name: "10 scans", price: 2.99, credits: 10, type: "credits", available: true },
        { code: "credits30", name: "30 scans", price: 5.99, credits: 30, type: "credits", available: true },
        { code: "credits100", name: "100 scans", price: 12.99, credits: 100, type: "credits", available: true },
      ],
    };

    const $ = (id) => document.getElementById(id);
    const fileInput = $("fileInput");
    const cameraBtn = $("cameraBtn");
    const uploadBtn = $("uploadBtn");
    const scanBtn = $("scanBtn");
    const previewGrid = $("previewGrid");
    const loadingCard = $("loadingCard");
    const errorCard = $("errorCard");
    const errorText = $("errorText");
    const results = $("results");
    const missionCard = $("missionCard");
    const missionText = $("missionText");
    const reverbBtn = $("reverbBtn");
    const buyCostInput = $("buyCost");

    let imageQueue = [];
    let appraisal = null;
    let installPrompt = null;
    let requestedPhotoMode = false;
    let settings = loadSettings();
    const installId = getInstallId();
    let currentScanId = newScanId();
    let billingState = null;
    let scanInFlight = false;
    let autoScanQueued = false;

    function getInstallId() {
      let id = localStorage.getItem("machzero.installId") || "";
      if (!/^[a-zA-Z0-9_-]{12,128}$/.test(id)) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, "_");
        localStorage.setItem("machzero.installId", id);
      }
      return id;
    }

    function newScanId() {
      return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function loadSettings() {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("machzero.settings") || "{}") };
      } catch (_) {
        return { ...DEFAULT_SETTINGS };
      }
    }

    function money(value) {
      const n = Number(value);
      return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) : "—";
    }

    function clampNumber(value, fallback, min, max) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    function setBusy(isBusy) {
      loadingCard.style.display = isBusy ? "flex" : "none";
      cameraBtn.disabled = isBusy;
      uploadBtn.disabled = isBusy;
      scanBtn.disabled = isBusy;
      if (isBusy) {
        errorCard.style.display = "none";
        $("autoScanNote").textContent = appraisal ? "MachZero is refining the same item — no extra scan credit." : "MachZero is identifying the item and pricing it now…";
      } else {
        $("autoScanNote").textContent = "Analysis starts automatically after your photo is ready.";
      }
    }

    function showError(message) {
      errorText.textContent = message;
      errorCard.style.display = "block";
      scanBtn.hidden = imageQueue.length === 0;
      scanBtn.textContent = appraisal ? "RETRY REFINEMENT" : "RETRY ANALYSIS";
      errorCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function updateScanButton() {
      // MachZero is zero-input by default. This button only appears after an error as a retry fallback.
      if (!errorCard || errorCard.style.display !== "block") scanBtn.hidden = true;
      scanBtn.textContent = appraisal ? "RETRY REFINEMENT" : "RETRY ANALYSIS";
    }

    function openPicker(capture) {
      requestedPhotoMode = Boolean(capture && appraisal?.nextPhotoRequest);
      errorCard.style.display = "none";
      if (capture) fileInput.setAttribute("capture", "environment");
      else fileInput.removeAttribute("capture");
      fileInput.click();
    }

    cameraBtn.addEventListener("click", () => openPicker(true));
    uploadBtn.addEventListener("click", () => openPicker(false));
    $("missionPhotoBtn").addEventListener("click", () => openPicker(true));

    fileInput.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []).slice(0, Math.max(0, MAX_PHOTOS - imageQueue.length));
      fileInput.value = "";
      if (!files.length) return;

      let added = 0;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const item = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          previewUrl: URL.createObjectURL(file),
          dataUrl: null,
        };
        imageQueue.push(item);
        addPreview(item);
        try {
          item.dataUrl = await compressImage(file);
          added += 1;
        } catch (error) {
          removePhoto(item.id);
          showError("One photo could not be prepared. Try that photo again.");
        }
      }

      requestedPhotoMode = false;
      updateScanButton();
      if (added > 0) queueAutoScan();
    });

    function queueAutoScan() {
      if (!imageQueue.length) return;
      if (scanInFlight) {
        autoScanQueued = true;
        return;
      }
      // Let the preview paint before the network work starts so the interaction feels immediate.
      setTimeout(() => runScan(true), 40);
    }

    function addPreview(item) {
      const wrapper = document.createElement("div");
      wrapper.className = "preview";
      wrapper.dataset.id = item.id;
      const image = document.createElement("img");
      image.src = item.previewUrl;
      image.alt = "Item photo";
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove photo");
      remove.addEventListener("click", () => removePhoto(item.id));
      wrapper.append(image, remove);
      previewGrid.appendChild(wrapper);
    }

    function removePhoto(id) {
      const index = imageQueue.findIndex((item) => item.id === id);
      if (index >= 0) {
        URL.revokeObjectURL(imageQueue[index].previewUrl);
        imageQueue.splice(index, 1);
      }
      previewGrid.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
      if (imageQueue.length === 0 && appraisal) {
        resetScanSession(false);
        return;
      }
      updateScanButton();
    }

    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function loadImage(dataUrl) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });
    }

    async function compressImage(file) {
      const original = await fileToDataUrl(file);
      const image = await loadImage(original);
      const targetChars = 600000;
      let maxDimension = 1800;
      let quality = 0.86;
      let output = original;

      for (let attempt = 0; attempt < 5; attempt++) {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.drawImage(image, 0, 0, width, height);
        output = canvas.toDataURL("image/jpeg", quality);
        if (output.length <= targetChars || maxDimension <= 1150) break;
        maxDimension = Math.round(maxDimension * 0.86);
        quality = Math.max(0.72, quality - 0.04);
      }
      return output;
    }

    scanBtn.addEventListener("click", () => runScan(false));
    $("errorRetryBtn").addEventListener("click", () => runScan(false));
