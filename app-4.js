    async function openBillingModal(notice = "") {
      await loadBillingStatus();
      renderBillingCards();
      const noticeEl = $("billingNotice");
      noticeEl.textContent = notice;
      noticeEl.classList.remove("notice-error");
      noticeEl.style.display = notice ? "block" : "none";
      openModal("billingModal");
    }

    async function startCheckout(code, button) {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "OPENING STRIPE…";
      try {
        const response = await fetch("/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-MachZero-Install-Id": installId },
          body: JSON.stringify({ code, installId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) throw new Error(payload.error || "Stripe Checkout could not start.");
        location.href = payload.url;
      } catch (error) {
        showError(error.message);
        button.disabled = false;
        button.textContent = original;
      }
    }

    async function confirmReturnedCheckout() {
      const params = new URLSearchParams(location.search);
      const state = params.get("checkout");
      const sessionId = params.get("session_id");
      if (!state) return;

      history.replaceState({}, "", location.pathname + location.hash);
      if (state === "cancelled") {
        await openBillingModal("Checkout was canceled. No charge was made.");
        return;
      }
      if (state !== "success" || !sessionId) return;

      try {
        const response = await fetch("/api/confirm-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-MachZero-Install-Id": installId },
          body: JSON.stringify({ sessionId, installId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Payment confirmation is still processing.");
        billingState = payload;
        renderUsage(payload.user, payload.configured);
        const paidAccess = Boolean((payload.user?.plan && payload.user.plan !== "free" && ["active", "trialing", "past_due"].includes(String(payload.user?.status || ""))) || Number(payload.user?.bonusCredits || 0) > 0);
        if (paidAccess && !payload.user?.hasRecoveryKey) {
          await createRecoveryKey({ afterPurchase: true });
        } else {
          await openBillingModal("Payment confirmed. Your MachZero scans are ready.");
        }
      } catch (error) {
        await openBillingModal("Stripe received the checkout. MachZero is still syncing the purchase; refresh in a moment if the scan count has not updated yet.");
      }
    }

    let visibleRecoveryKey = "";

    function setRecoveryNotice(message = "", isError = false) {
      const notice = $("recoveryNotice");
      notice.textContent = message;
      notice.style.display = message ? "block" : "none";
      notice.classList.toggle("notice-error", Boolean(isError));
    }

    function showRecoveryCreateView(recoveryKey, message = "") {
      visibleRecoveryKey = recoveryKey || "";
      setRecoveryNotice();
      $("recoveryRestoreView").hidden = true;
      $("recoveryCreateView").hidden = false;
      $("recoveryKeyOutput").textContent = visibleRecoveryKey;
      $("recoveryCreateText").textContent = message || "Save this key somewhere private. It moves your paid MachZero access to a replacement device.";
      openModal("recoveryModal");
    }

    function showRecoveryRestoreView() {
      visibleRecoveryKey = "";
      setRecoveryNotice();
      $("recoveryCreateView").hidden = true;
      $("recoveryRestoreView").hidden = false;
      $("recoveryKeyInput").value = "";
      openModal("recoveryModal");
      setTimeout(() => $("recoveryKeyInput").focus(), 50);
    }

    async function createRecoveryKey({ afterPurchase = false } = {}) {
      const button = $("createRecoveryKeyBtn");
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "CREATING KEY…";
      try {
        const response = await fetch("/api/create-recovery-key", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-MachZero-Install-Id": installId },
          body: JSON.stringify({ installId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.recoveryKey) throw new Error(payload.error || "MachZero could not create a recovery key.");
        if (payload.user && billingState) billingState.user = payload.user;
        closeModal("billingModal");
        showRecoveryCreateView(
          payload.recoveryKey,
          afterPurchase
            ? "Payment confirmed. Save this recovery key now so you can move your paid MachZero access if you replace or reset this device."
            : payload.message,
        );
      } catch (error) {
        if (afterPurchase) {
          await openBillingModal("Payment confirmed. Your scans are ready, but MachZero could not create a recovery key yet. Use Create Recovery Key before changing or resetting devices.");
        } else {
          const notice = $("billingNotice");
          notice.textContent = error.message || "MachZero could not create a recovery key.";
          notice.classList.add("notice-error");
          notice.style.display = "block";
        }
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }

    async function restorePaidAccess() {
      const button = $("submitRestoreBtn");
      const recoveryKey = $("recoveryKeyInput").value.trim();
      if (!recoveryKey) return;
      button.disabled = true;
      button.textContent = "RESTORING…";
      try {
        const response = await fetch("/api/restore-access", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-MachZero-Install-Id": installId },
          body: JSON.stringify({ installId, recoveryKey }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "MachZero could not restore paid access.");
        billingState = payload;
        renderUsage(payload.user, payload.configured);
        closeModal("recoveryModal");
        await openBillingModal(payload.message || "Paid access restored on this device.");
      } catch (error) {
        $("recoveryKeyInput").focus();
        setRecoveryNotice(error.message || "MachZero could not restore paid access.", true);
      } finally {
        button.disabled = false;
        button.textContent = "RESTORE ACCESS";
      }
    }

    $("createRecoveryKeyBtn").addEventListener("click", () => createRecoveryKey());
    $("restoreAccessBtn").addEventListener("click", showRecoveryRestoreView);
    $("submitRestoreBtn").addEventListener("click", restorePaidAccess);
    $("recoveryKeyInput").addEventListener("keydown", (event) => { if (event.key === "Enter") restorePaidAccess(); });
    $("copyRecoveryKeyBtn").addEventListener("click", async () => {
      if (!visibleRecoveryKey) return;
      try {
        await navigator.clipboard.writeText(visibleRecoveryKey);
        $("copyRecoveryKeyBtn").textContent = "KEY COPIED";
        setTimeout(() => $("copyRecoveryKeyBtn").textContent = "COPY RECOVERY KEY", 1300);
      } catch (_) {
        showError("Clipboard access was blocked. Write the recovery key down before closing this screen.");
      }
    });
    $("shareRecoveryKeyBtn").addEventListener("click", async () => {
      if (!visibleRecoveryKey) return;
      const text = `MachZero™ recovery key: ${visibleRecoveryKey}
Keep this private. It can move paid MachZero access to another device.`;
      try {
        if (navigator.share) await navigator.share({ title: "MachZero™ Recovery Key", text });
        else await navigator.clipboard.writeText(text);
      } catch (error) {
        if (error?.name !== "AbortError") showError("Sharing was blocked. Copy the recovery key instead.");
      }
    });

    $("planBtn").addEventListener("click", () => openBillingModal());
    $("usagePill").addEventListener("click", () => openBillingModal());

    async function openCustomerPortal() {
      const button = $("manageBillingBtn");
      button.disabled = true;
      button.textContent = "OPENING STRIPE…";
      try {
        const response = await fetch("/api/create-portal", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-MachZero-Install-Id": installId },
          body: JSON.stringify({ installId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) throw new Error(payload.error || "Billing portal unavailable.");
        location.href = payload.url;
      } catch (error) {
        showError(error.message);
        button.disabled = false;
        button.textContent = "MANAGE SUBSCRIPTION";
      }
    }

    $("manageBillingBtn").addEventListener("click", openCustomerPortal);
