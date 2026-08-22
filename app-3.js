    document.querySelectorAll("[data-market]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!appraisal) return;
        try { await navigator.clipboard.writeText(buildListingText(appraisal)); } catch (_) {}
        window.open(button.dataset.url, "_blank", "noopener,noreferrer");
      });
    });

    reverbBtn.addEventListener("click", async () => {
      if (!appraisal) return;
      reverbBtn.disabled = true;
      reverbBtn.textContent = "CREATING DRAFT…";
      try {
        const response = await fetch("/api/reverb-draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-MachZero-Install-Id": installId,
          },
          body: JSON.stringify({
            installId,
            appraisalToken: appraisal.draftToken,
            description: appraisal.listingDescription,
            images: imageQueue.map((item) => item.dataUrl).filter(Boolean),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Reverb rejected the draft.");
        if (confirm("Draft created in Reverb. Open your Reverb drafts now?")) {
          window.open("https://reverb.com/my/listings?state=draft", "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        showError(error.message);
      } finally {
        reverbBtn.disabled = false;
        reverbBtn.textContent = "Reverb Draft";
      }
    });

    function isMusicGear(title) {
      return /guitar|bass|amplifier|\bamp\b|pedal|effects|synth|keyboard|pickup|drum|fender|gibson|ibanez|epiphone|martin|taylor|gretsch|squier/i.test(title);
    }

    function renderUsage(user, configured = true) {
      if (!user) return;
      const remaining = Math.max(0, Number(user.remaining ?? user.includedRemaining ?? 0));
      const paymentIssue = user.plan && user.plan !== "free" && !["active", "trialing"].includes(String(user.status || ""));
      $("usageText").textContent = paymentIssue
        ? `${user.planName || "Plan"} · payment issue`
        : `${user.planName || "Free"} · ${remaining} scan${remaining === 1 ? "" : "s"} left`;
      $("usagePill").classList.toggle("limit", remaining <= 0 || paymentIssue);
      $("planBtn").textContent = user.plan && user.plan !== "free" ? "PLAN" : "UPGRADE";
      $("manageBillingBtn").hidden = !user.stripeSubscriptionId;
      if (!configured && !billingState?.enforcementRequested) $("usageText").textContent = "Free · billing setup pending";
      if (!configured && billingState?.enforcementRequested) $("usageText").textContent = "Billing temporarily unavailable";
    }

    async function loadBillingStatus() {
      try {
        const response = await fetch("/api/billing-status", {
          method: "GET",
          headers: { "X-MachZero-Install-Id": installId, Accept: "application/json" },
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Billing status unavailable.");
        billingState = payload;
        renderUsage(payload.user, payload.configured);
        return payload;
      } catch (error) {
        console.warn("MachZero billing status unavailable:", error.message);
        billingState = { configured: false, enforcementRequested: false, user: { plan: "free", planName: "Free", remaining: 5, allowance: 5, used: 0, bonusCredits: 0, hasRecoveryKey: false }, catalog: BILLING_FALLBACK };
        renderUsage(billingState.user, false);
        return billingState;
      }
    }

    function renderBillingCards() {
      const catalog = billingState?.catalog || BILLING_FALLBACK;
      const user = billingState?.user || { plan: "free" };
      const plans = $("planCards");
      const credits = $("creditCards");
      plans.innerHTML = "";
      credits.innerHTML = "";

      catalog.plans.forEach((plan) => {
        const card = document.createElement("div");
        card.className = `plan-card${plan.recommended ? " recommended" : ""}`;
        const head = document.createElement("div");
        head.className = "plan-head";
        const left = document.createElement("div");
        const name = document.createElement("div");
        name.className = "plan-name";
        name.textContent = plan.name;
        if (plan.recommended) {
          const badge = document.createElement("span");
          badge.className = "plan-badge";
          badge.textContent = "Best value";
          name.appendChild(badge);
        }
        const meta = document.createElement("div");
        meta.className = "plan-meta";
        meta.textContent = `${plan.scans} new-item appraisals per month · full MachZero pricing on every scan`;
        left.append(name, meta);
        const price = document.createElement("div");
        price.className = "plan-price";
        price.textContent = plan.price ? `$${Number(plan.price).toFixed(2)}/mo` : "$0";
        head.append(left, price);
        card.appendChild(head);

        const button = document.createElement("button");
        button.className = plan.code === "reseller" ? "btn btn-primary" : "btn btn-ghost";
        button.type = "button";
        if (plan.code === user.plan) {
          button.textContent = "CURRENT PLAN";
          button.disabled = true;
        } else if (plan.type === "free") {
          button.textContent = "FREE PLAN";
          button.disabled = true;
        } else if (!plan.available || billingState?.configured === false) {
          button.textContent = "SETUP PENDING";
          button.disabled = true;
        } else if (user.plan && user.plan !== "free" && plan.type === "subscription") {
          button.textContent = "CHANGE PLAN";
          button.addEventListener("click", () => openCustomerPortal());
        } else {
          button.textContent = `CHOOSE ${plan.name.toUpperCase()}`;
          button.addEventListener("click", () => startCheckout(plan.code, button));
        }
        card.appendChild(button);
        plans.appendChild(card);
      });

      catalog.credits.forEach((pack) => {
        const card = document.createElement("div");
        card.className = "credit-card";
        const title = document.createElement("strong");
        title.textContent = `${pack.credits} scans`;
        const price = document.createElement("span");
        price.textContent = `$${Number(pack.price).toFixed(2)}`;
        const button = document.createElement("button");
        button.className = "btn btn-ghost";
        button.type = "button";
        button.textContent = (!pack.available || billingState?.configured === false) ? "SETUP" : "BUY";
        button.disabled = !pack.available || billingState?.configured === false;
        if (!button.disabled) button.addEventListener("click", () => startCheckout(pack.code, button));
        card.append(title, price, button);
        credits.appendChild(card);
      });

      const bonus = Number(user.bonusCredits || 0);
      const included = Math.max(0, Number(user.includedRemaining ?? user.remaining ?? 0));
      const paymentIssue = user.plan && user.plan !== "free" && !["active", "trialing"].includes(String(user.status || ""));
      $("billingSummary").textContent = paymentIssue
        ? `${user.planName || "MachZero plan"} has a payment issue. Included subscription scans are paused until Stripe confirms the plan is active again${bonus ? `; ${bonus} purchased scan credit${bonus === 1 ? " remains" : "s remain"}.` : "."}`
        : `${user.planName || "Free"}: ${included} included scan${included === 1 ? "" : "s"} left${bonus ? ` + ${bonus} extra credit${bonus === 1 ? "" : "s"}` : ""}. One new item appraisal uses one scan; requested follow-up photos for that item are free.`;
      $("manageBillingBtn").hidden = !user.stripeSubscriptionId;
      const hasPaidAccess = Boolean((user.plan && user.plan !== "free" && ["active", "trialing", "past_due"].includes(String(user.status || ""))) || bonus > 0);
      $("createRecoveryKeyBtn").hidden = !hasPaidAccess;
      $("createRecoveryKeyBtn").textContent = user.hasRecoveryKey ? "ROTATE RECOVERY KEY" : "CREATE RECOVERY KEY";
    }
