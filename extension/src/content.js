// content.js — GitHub PR pages: sidebar + score

(function () {
  const match = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!match) return;

  const [, owner, repo, prNumber] = match;
  const STORAGE_COLLAPSE = "janitor.sidebarCollapsed";

  const CHECK_TITLES = {
    no_linked_issue: "Linked issue",
    generic_title: "Title quality",
    large_diff: "Change size",
    no_tests: "Tests",
    many_unrelated_files: "Scope",
  };

  function scoreClass(score) {
    if (score >= 70) return "janitor-score--high";
    if (score >= 40) return "janitor-score--mid";
    return "janitor-score--low";
  }

  function formatCheckTitle(flag) {
    return (
      CHECK_TITLES[flag] ||
      flag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  function ensureRoot() {
    let root = document.getElementById("janitor-sidebar-root");
    if (root) return root;
    root = document.createElement("div");
    root.id = "janitor-sidebar-root";
    const collapsed = sessionStorage.getItem(STORAGE_COLLAPSE) === "1";
    if (collapsed) root.classList.add("janitor-sidebar--collapsed");
    document.documentElement.appendChild(root);
    return root;
  }

  function setCollapsed(collapsed) {
    const root = document.getElementById("janitor-sidebar-root");
    if (!root) return;
    root.classList.toggle("janitor-sidebar--collapsed", collapsed);
    sessionStorage.setItem(STORAGE_COLLAPSE, collapsed ? "1" : "0");
  }

  function renderLoading(root) {
    root.innerHTML = `
      <div class="janitor-sidebar-panel" role="complementary" aria-label="Janitor">
        <div class="janitor-sidebar-header">
          <div class="janitor-brand"><span aria-hidden="true">🧹</span> Janitor</div>
          <button type="button" class="janitor-collapse-btn" data-janitor-collapse>Hide</button>
        </div>
        <div class="janitor-loading">Scoring this PR…</div>
      </div>
      <button type="button" class="janitor-sidebar-tab" data-janitor-tab aria-label="Open Janitor">Janitor</button>
    `;
    wireChrome(root);
  }

  function wireChrome(root) {
    root.querySelector("[data-janitor-collapse]")?.addEventListener("click", () =>
      setCollapsed(true)
    );
    root.querySelector("[data-janitor-tab]")?.addEventListener("click", () =>
      setCollapsed(false)
    );
  }

  function renderError(root, message) {
    const panel = root.querySelector(".janitor-sidebar-panel");
    if (!panel) return;
    panel.innerHTML = `
      <div class="janitor-sidebar-header">
        <div class="janitor-brand"><span aria-hidden="true">🧹</span> Janitor</div>
        <button type="button" class="janitor-collapse-btn" data-janitor-collapse>Hide</button>
      </div>
      <p class="janitor-error">${escapeHtml(message)}</p>
    `;
    wireChrome(root);
  }

  function renderScore(root, data) {
    const panel = root.querySelector(".janitor-sidebar-panel");
    if (!panel) return;
    const sc = scoreClass(data.score);
    const checksHtml = (data.checks || [])
      .map((c) => {
        const pass = c.weight === 0;
        const rowClass = pass ? "janitor-check janitor-check-pass" : "janitor-check janitor-check-fail";
        const icon = pass ? "✓" : "✗";
        return `
          <div class="${rowClass}">
            <span class="janitor-check-icon" aria-hidden="true">${icon}</span>
            <div class="janitor-check-body">
              <div class="janitor-check-name">${escapeHtml(formatCheckTitle(c.flag))}</div>
              <div class="janitor-check-detail">${escapeHtml(c.detail || "")}</div>
            </div>
          </div>`;
      })
      .join("");

    panel.innerHTML = `
      <div class="janitor-sidebar-header">
        <div class="janitor-brand"><span aria-hidden="true">🧹</span> Janitor</div>
        <button type="button" class="janitor-collapse-btn" data-janitor-collapse>Hide</button>
      </div>
      <div class="janitor-score-block">
        <div class="janitor-score-value ${sc}" aria-live="polite">${data.score}</div>
        <div class="janitor-score-label">Slop score</div>
      </div>
      <p class="janitor-verdict">${escapeHtml(data.verdict || "")}</p>
      <div class="janitor-breakdown-title">Heuristics</div>
      ${checksHtml}
      <div class="janitor-toolbar-title">Triage</div>
      <div class="janitor-toolbar">
        <button type="button" data-janitor-action="label_ai">Label: AI-generated</button>
        <button type="button" class="janitor-btn-danger" data-janitor-action="close">Close PR</button>
        <button type="button" class="janitor-btn-ok" data-janitor-action="approve">Approve PR</button>
      </div>
      <p class="janitor-sidebar-footnote">Actions use your saved GitHub token when possible; otherwise a new tab opens on GitHub.</p>
    `;
    wireChrome(root);
    panel.querySelectorAll("[data-janitor-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-janitor-action");
        runTriage(action);
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function runTriage(action) {
    chrome.runtime.sendMessage(
      {
        type: "GITHUB_TRIAGE",
        action,
        payload: { owner, repo, prNumber },
      },
      (res) => {
        if (chrome.runtime.lastError) {
          console.error("[Janitor]", chrome.runtime.lastError.message);
          return;
        }
        const openFallback =
          res &&
          res.fallbackUrl &&
          (res.error || res.ok === false || !res.usedApi);
        if (openFallback) {
          window.open(res.fallbackUrl, "_blank", "noopener,noreferrer");
        }
      }
    );
  }

  const root = ensureRoot();
  renderLoading(root);

  chrome.runtime.sendMessage(
    { type: "SCORE_PR", payload: { owner, repo, prNumber } },
    (response) => {
      if (chrome.runtime.lastError) {
        renderError(root, chrome.runtime.lastError.message);
        return;
      }
      if (response?.error) {
        renderError(root, response.error);
        return;
      }
      renderScore(root, response);
    }
  );
})();
