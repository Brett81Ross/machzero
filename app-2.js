    async function runScan(autoTriggered = false) {
      if (!imageQueue.length) return;
      if (scanInFlight) {
        autoScanQueued = true;
        return;
      }
      if (imageQueue.some((item) => !item.dataUrl)) {
        if (autoTriggered) {
          autoScanQueued = true;
          setTimeout(() => queueAutoScan(), 120);
        } else {
          showError("The photos are still being prepared. Try again in a moment.");
        }
        return;
      }

      scanInFlight = true;
      autoScanQueued = false;
      $("loadingText").textContent = appraisal ? "Reading the new evidence and tightening the price…" : "Identifying the item, reading visible details, and checking the market…";
      setBusy(true);
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-MachZero-Install-Id": installId,
            "X-MachZero-Scan-Id": currentScanId,
          },
          body: JSON.stringify({ images: imageQueue.map((item) => item.dataUrl), appVersion: APP_VERSION, installId, scanId: currentScanId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 402 && payload.code === "SCAN_LIMIT_REACHED") {
          if (payload.usage) renderUsage(payload.usage, true);
          await loadBillingStatus();
          openBillingModal("You've used the scans included with your current plan. Pick a plan or add a scan pack to keep going.");
          return;
        }
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `MachZero received server status ${response.status}.`);
        }
        if (payload.usage) renderUsage(payload.usage, true);
        appraisal = payload.appraisal || payload.pricing;
        if (!appraisal?.recommendedListPrice) throw new Error("The appraisal came back incomplete. Try the scan again.");
        renderAppraisal(appraisal);
      } catch (error) {
        console.error("MachZero scan error:", error);
        showError(error.message || "The scan could not finish.");
      } finally {
        scanInFlight = false;
        setBusy(false);
        if (autoScanQueued) {
          autoScanQueued = false;
          queueAutoScan();
        }
      }
    }

    function renderAppraisal(data) {
      $("itemTitle").textContent = data.itemTitle || "Unidentified resale item";
      $("listPrice").textContent = money(data.recommendedListPrice);
      $("expectedPrice").textContent = money(data.expectedSalePrice);
      $("quickPrice").textContent = money(data.quickSalePrice);
      $("pricingConfidence").textContent = `Price ${Math.round(Number(data.pricingConfidence) || 0)}%`;
      $("identityConfidence").textContent = `ID ${Math.round(Number(data.identificationConfidence) || 0)}%`;
      $("conditionChip").textContent = data.conditionGrade || "Condition unknown";
      if (Number(data.pricingConfidence) >= 80) $("pricingConfidence").classList.add("good");
      else $("pricingConfidence").classList.remove("good");
      if (Number(data.identificationConfidence) >= 85) $("identityConfidence").classList.add("good");
      else $("identityConfidence").classList.remove("good");

      $("bestMarketplace").textContent = data.marketplaceRecommendations?.[0] || "eBay";
      renderDetectedDetails(data);
      $("marketBasis").textContent = data.marketBasis || "MachZero calculated this price from the strongest evidence available.";
      renderComparables(data.comparableSummary || []);
      renderSources(data.sources || []);
      $("listingCopy").textContent = buildListingText(data);

      missionText.textContent = data.nextPhotoRequest || "";
      missionCard.style.display = data.nextPhotoRequest ? "block" : "none";

      reverbBtn.hidden = !data.draftToken || !isMusicGear(data.itemTitle || "") || !data.conditionGrade || data.conditionGrade === "Unknown";
      updateEconomics();
      results.style.display = "block";
      updateScanButton();
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderDetectedDetails(data) {
      const container = $("detectedDetails");
      container.innerHTML = "";
      const details = [
        ["Category", data.category],
        ["Brand", data.brand],
        ["Model", data.model],
        ["Variant", data.variant],
        ["Style / SKU", data.styleSku],
        ["Size", data.size],
        ["Color", data.color],
        ["Included", Array.isArray(data.includedAccessories) ? data.includedAccessories.join(", ") : data.includedAccessories],
      ].filter(([, value]) => value && String(value).trim() && !/^unknown$/i.test(String(value).trim()));

      if (!details.length) {
        const p = document.createElement("p");
        p.textContent = "MachZero could not defend additional identity details from the supplied photo.";
        container.appendChild(p);
      } else {
        details.forEach(([label, value]) => {
          const row = document.createElement("div");
          row.className = "market-row";
          const left = document.createElement("span");
          left.textContent = label;
          const right = document.createElement("strong");
          right.textContent = String(value);
          row.append(left, right);
          container.appendChild(row);
        });
      }
      $("conditionNotes").textContent = data.conditionNotes ? `Condition evidence: ${data.conditionNotes}` : "";
    }

    function renderComparables(items) {
      const container = $("comparables");
      container.innerHTML = "";
      if (!items.length) {
        const p = document.createElement("p");
        p.textContent = "No sufficiently close public comparables were verified for this scan.";
        container.appendChild(p);
        return;
      }
      const title = document.createElement("strong");
      title.textContent = "Comparable evidence";
      container.appendChild(title);
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "comp";
        const heading = document.createElement("strong");
        heading.textContent = `${item.marketplace || "Market"} · ${money(item.price)}`;
        const body = document.createElement("div");
        body.textContent = `${item.listingType || "Reference"} · ${item.matchQuality || "Broad"} match${item.notes ? ` — ${item.notes}` : ""}`;
        row.append(heading, body);
        container.appendChild(row);
      });
    }

    function renderSources(sources) {
      const container = $("sources");
      container.innerHTML = "";
      if (!sources.length) return;
      const title = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Market sources";
      title.appendChild(strong);
      container.appendChild(title);
      sources.forEach((source) => {
        if (!source?.url) return;
        const p = document.createElement("p");
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.title || source.url;
        p.appendChild(link);
        container.appendChild(p);
      });
    }

    function buildListingText(data) {
      return `TITLE: ${data.itemTitle || "Item"}\nASKING PRICE: ${money(data.recommendedListPrice)}\n\n${data.listingDescription || "See photos for condition details."}`;
    }

    function currentEconomics() {
      if (!appraisal) return null;
      const expected = Number(appraisal.expectedSalePrice) || 0;
      const feeRate = clampNumber(settings.feeRate, DEFAULT_SETTINGS.feeRate, 0, 50) / 100;
      const targetMargin = clampNumber(settings.targetMargin, DEFAULT_SETTINGS.targetMargin, 0, 80) / 100;
      const shipping = clampNumber(settings.shippingAllowance, 0, 0, 10000);
      const netBeforeBuy = Math.max(0, expected * (1 - feeRate) - shipping);
      const maxBuy = Math.max(0, expected * (1 - feeRate - targetMargin) - shipping);
      const buyCost = Math.max(0, Number(buyCostInput.value) || 0);
      const profit = netBeforeBuy - buyCost;
      return { feeRate, targetMargin, shipping, netBeforeBuy, maxBuy, buyCost, profit };
    }

    function updateEconomics() {
      const econ = currentEconomics();
      if (!econ) return;
      $("maxBuyPrice").textContent = money(econ.maxBuy);
      $("decisionMaxBuy").textContent = money(econ.maxBuy);
      $("targetProfitValue").textContent = money(Math.max(0, econ.netBeforeBuy - econ.maxBuy));
      if (!buyCostInput.value) {
        $("decisionText").textContent = "BUY AT OR BELOW";
        $("decisionText").style.color = "var(--green)";
        $("actualProfitValue").textContent = "—";
      } else {
        const shouldBuy = econ.buyCost <= econ.maxBuy;
        $("decisionText").textContent = shouldBuy ? "BUY" : "PASS";
        $("decisionText").style.color = shouldBuy ? "var(--green)" : "var(--red)";
        $("actualProfitValue").textContent = money(econ.profit);
      }
      $("profitNote").textContent = `MachZero calculated Max Buy and target profit automatically from the photos using ${settings.feeRate}% fees, ${settings.targetMargin}% target margin, and ${money(settings.shippingAllowance)} seller-paid shipping.`;
    }

    buyCostInput.addEventListener("input", updateEconomics);

    $("copyListingBtn").addEventListener("click", async () => {
      if (!appraisal) return;
      try {
        await navigator.clipboard.writeText(buildListingText(appraisal));
        $("copyListingBtn").textContent = "COPIED";
        setTimeout(() => $("copyListingBtn").textContent = "COPY LISTING", 1300);
      } catch (_) {
        showError("Clipboard access was blocked by this browser.");
      }
    });
