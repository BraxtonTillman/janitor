// pulls.js — score badges on the repo pull request list

(function () {
  const pathMatch = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pulls(?:\/|$)/
  );
  if (!pathMatch) return;

  const [, owner, repo] = pathMatch;
  const hrefRe = new RegExp(
    `^/${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/pull/(\\d+)/?$`
  );

  const badged = new Map();
  const deferredFetch = new Set();
  let batchBusy = false;
  let debounceTimer;

  function prFromAnchor(a) {
    const href = a.getAttribute("href") || "";
    if (
      href.includes("/files") ||
      href.includes("/commits") ||
      href.includes("/checks")
    )
      return null;
    const m = href.match(hrefRe);
    return m ? m[1] : null;
  }

  function collectPrNumbers() {
    const nums = new Set();
    const anchors = document.querySelectorAll(
      `a[href^="/${owner}/${repo}/pull/"]`
    );
    anchors.forEach((a) => {
      const n = prFromAnchor(a);
      if (n) nums.add(n);
    });
    return nums;
  }

  function findTitleAnchor(pr) {
    const want = `/${owner}/${repo}/pull/${pr}`;
    const anchors = document.querySelectorAll(
      `a[href^="/${owner}/${repo}/pull/"]`
    );
    let titleLink = null;
    let numberLink = null;
    let anyLink = null;
    anchors.forEach((a) => {
      if ((a.getAttribute("href") || "").split("?")[0] !== want) return;
      if (!anyLink) anyLink = a;
      const t = (a.textContent || "").trim();
      if (/^#\d+$/.test(t)) numberLink = a;
      else if (t) titleLink = a;
    });
    return titleLink || numberLink || anyLink;
  }

  function scoreClass(score) {
    if (score >= 70) return "janitor-score--high";
    if (score >= 40) return "janitor-score--mid";
    return "janitor-score--low";
  }

  function ensureBadge(pr) {
    if (badged.has(pr)) return badged.get(pr);
    const anchor = findTitleAnchor(pr);
    if (!anchor || !anchor.parentNode) return null;
    const existing = anchor.parentNode.querySelector(
      `[data-janitor-pr-badge="${pr}"]`
    );
    if (existing) {
      badged.set(pr, existing);
      return existing;
    }
    const el = document.createElement("span");
    el.className = "janitor-pull-badge janitor-pull-badge--loading";
    el.setAttribute("data-janitor-pr-badge", pr);
    el.textContent = "…";
    el.title = "Janitor slop score";
    anchor.insertAdjacentElement("afterend", el);
    badged.set(pr, el);
    return el;
  }

  function setBadgeState(pr, score, err) {
    const el = badged.get(pr);
    if (!el) return;
    el.classList.remove(
      "janitor-pull-badge--loading",
      "janitor-score--low",
      "janitor-score--mid",
      "janitor-score--high",
      "janitor-pull-badge--err"
    );
    if (err) {
      el.classList.add("janitor-pull-badge--err");
      el.textContent = "—";
      el.title = err;
      return;
    }
    el.classList.add(scoreClass(score));
    el.textContent = String(score);
    el.title = `Slop score: ${score}`;
  }

  function flushBatch() {
    if (batchBusy || !deferredFetch.size) return;
    batchBusy = true;
    const need = [...deferredFetch];
    deferredFetch.clear();
    chrome.runtime.sendMessage(
      {
        type: "SCORE_PR_BATCH",
        payload: { owner, repo, prNumbers: need },
      },
      (res) => {
        if (chrome.runtime.lastError || res?.error) {
          const msg =
            res?.error || chrome.runtime.lastError?.message || "Batch failed";
          need.forEach((p) => setBadgeState(p, 0, msg));
        } else {
          const scores = res || {};
          need.forEach((p) => {
            const row = scores[p];
            if (!row || row.error)
              setBadgeState(p, 0, row?.error || "No data");
            else setBadgeState(p, row.score, null);
          });
        }
        batchBusy = false;
        flushBatch();
      }
    );
  }

  function queueFetch(prNumbers) {
    prNumbers.forEach((p) => {
      if (badged.has(p)) deferredFetch.add(p);
    });
    flushBatch();
  }

  function scan() {
    const onPage = collectPrNumbers();
    const toFetch = [];
    onPage.forEach((pr) => {
      ensureBadge(pr);
      const el = badged.get(pr);
      if (
        el &&
        el.classList.contains("janitor-pull-badge--loading") &&
        el.textContent === "…"
      )
        toFetch.push(pr);
    });
    badged.forEach((_el, pr) => {
      if (!onPage.has(pr)) {
        badged.delete(pr);
      }
    });
    if (toFetch.length) queueFetch(toFetch);
  }

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, 80);
  }

  scan();
  const mo = new MutationObserver(debouncedScan);
  mo.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("pjax:end", debouncedScan);
  window.addEventListener("popstate", debouncedScan);
})();
