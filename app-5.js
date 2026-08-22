    function resetScanSession(scrollToTop = true) {
      imageQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      imageQueue = [];
      appraisal = null;
      requestedPhotoMode = false;
      autoScanQueued = false;
      currentScanId = newScanId();
      previewGrid.innerHTML = "";
      results.style.display = "none";
      missionCard.style.display = "none";
      errorCard.style.display = "none";
      buyCostInput.value = "";
      updateScanButton();
      if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
    }

    $("newItemBtn").addEventListener("click", () => resetScanSession(true));

    function openModal(id) {
      $(id).style.display = "flex";
    }
    function closeModal(id) {
      $(id).style.display = "none";
    }
    document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.style.display = "none"; }));

    $("settingsBtn").addEventListener("click", () => {
      $("feeRate").value = settings.feeRate;
      $("targetMargin").value = settings.targetMargin;
      $("shippingAllowance").value = settings.shippingAllowance;
      openModal("settingsModal");
    });

    $("saveSettingsBtn").addEventListener("click", () => {
      settings = {
        feeRate: clampNumber($("feeRate").value, DEFAULT_SETTINGS.feeRate, 0, 50),
        targetMargin: clampNumber($("targetMargin").value, DEFAULT_SETTINGS.targetMargin, 0, 80),
        shippingAllowance: clampNumber($("shippingAllowance").value, 0, 0, 10000),
      };
      localStorage.setItem("machzero.settings", JSON.stringify(settings));
      closeModal("settingsModal");
      updateEconomics();
    });

    function shareUrl() {
      return location.href.split(/[?#]/)[0];
    }

    function renderQr() {
      const qr = $("qrCode");
      qr.innerHTML = "";
      if (window.QRCode) {
        new QRCode(qr, {
          text: shareUrl(),
          width: 200,
          height: 200,
          colorDark: "#07152a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H,
        });
      }
    }

    function buildAppraisalShareText() {
      if (!appraisal) return "";
      const econ = currentEconomics();
      const marketplace = appraisal.marketplaceRecommendations?.[0] || "eBay";
      const confidence = Math.round(Number(appraisal.pricingConfidence) || 0);
      return [
        "MachZero™ Resale Evaluation",
        appraisal.itemTitle || "Resale item",
        "",
        `List: ${money(appraisal.recommendedListPrice)}`,
        `Expected Sale: ${money(appraisal.expectedSalePrice)}`,
        `Sell Fast: ${money(appraisal.quickSalePrice)}`,
        `Max Buy: ${money(econ?.maxBuy || 0)}`,
        `Confidence: ${confidence}%`,
        `Best Market: ${marketplace}`,
        "",
        "Evaluated with MachZero™",
        "Cactus🌵Byte Studios™",
      ].join("\n");
    }

    $("shareBtn").addEventListener("click", () => {
      renderQr();
      openModal("shareModal");
    });

    $("nativeShareBtn").addEventListener("click", async () => {
      const shareData = {
        title: "MachZero™",
        text: "Snap it. Price it. Decide with MachZero™ — AI-powered resale evaluation by Cactus🌵Byte Studios™.",
        url: shareUrl(),
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
          $("nativeShareBtn").textContent = "SHARE TEXT COPIED";
          setTimeout(() => $("nativeShareBtn").textContent = "SHARE MACHZERO", 1300);
        }
      } catch (error) {
        if (error?.name !== "AbortError") showError("Sharing was blocked by this browser.");
      }
    });

    $("shareAppraisalBtn").addEventListener("click", async () => {
      if (!appraisal) return;
      const text = buildAppraisalShareText();
      const shareData = {
        title: `${appraisal.itemTitle || "Item"} — MachZero™`,
        text,
        url: shareUrl(),
      };
      const button = $("shareAppraisalBtn");
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(`${text}\n${shareUrl()}`);
          button.textContent = "APPRAISAL COPIED";
          setTimeout(() => button.textContent = "SHARE APPRAISAL", 1300);
        }
      } catch (error) {
        if (error?.name !== "AbortError") showError("Sharing was blocked by this browser.");
      }
    });

    $("copyLinkBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareUrl());
        $("copyLinkBtn").textContent = "LINK COPIED";
        setTimeout(() => $("copyLinkBtn").textContent = "COPY LINK", 1300);
      } catch (_) {
        showError("Clipboard access was blocked by this browser.");
      }
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      $("installBtn").hidden = false;
    });
    $("installBtn").addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      installPrompt = null;
      $("installBtn").hidden = true;
    });
    window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; installPrompt = null; });

    loadBillingStatus();
    confirmReturnedCheckout();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker registration failed:", error)));
    }
  
