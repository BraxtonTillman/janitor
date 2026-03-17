// popup.js — PR summary + PAT settings

const prPathRe = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

function scoreClass(score) {
  if (score >= 70) return "janitor-score--high";
  if (score >= 40) return "janitor-score--mid";
  return "janitor-score--low";
}

function setVisible(id, on) {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
}

function loadToken() {
  chrome.storage.sync.get("githubToken", (data) => {
    const ta = document.getElementById("github-token");
    if (ta) ta.value = data.githubToken || "";
  });
}

function saveToken() {
  const ta = document.getElementById("github-token");
  const status = document.getElementById("save-status");
  const raw = (ta?.value || "").trim();
  chrome.storage.sync.set({ githubToken: raw || undefined }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = chrome.runtime.lastError.message;
      status.classList.add("error");
      return;
    }
    status.textContent = raw ? "Saved." : "Cleared.";
    status.classList.remove("error");
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
}

function showPRState(owner, repo, pr) {
  setVisible("popup-empty", false);
  setVisible("popup-pr", true);
  const lead = document.getElementById("popup-lead-pr");
  const scoreWrap = document.getElementById("popup-score-wrap");
  const scoreEl = document.getElementById("popup-score");
  const verdictEl = document.getElementById("popup-verdict");
  const statusEl = document.getElementById("popup-status");

  lead.textContent = `${owner}/${repo}#${pr}`;
  scoreWrap.hidden = true;
  statusEl.textContent = "Loading score…";
  statusEl.classList.remove("error");

  chrome.runtime.sendMessage(
    { type: "SCORE_PR", payload: { owner, repo, prNumber: pr } },
    (res) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = chrome.runtime.lastError.message;
        statusEl.classList.add("error");
        return;
      }
      if (res?.error) {
        statusEl.textContent = res.error;
        statusEl.classList.add("error");
        return;
      }
      statusEl.textContent = "";
      scoreWrap.hidden = false;
      scoreEl.textContent = String(res.score);
      scoreEl.className = "popup-score " + scoreClass(res.score);
      verdictEl.textContent = res.verdict || "";
    }
  );
}

function showEmptyState() {
  setVisible("popup-pr", false);
  setVisible("popup-empty", true);
}

function init() {
  loadToken();
  document.getElementById("save-token")?.addEventListener("click", saveToken);

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) {
      showEmptyState();
      return;
    }
    let path;
    try {
      path = new URL(tab.url).pathname;
    } catch {
      showEmptyState();
      return;
    }
    const m = path.match(prPathRe);
    if (m) showPRState(m[1], m[2], m[3]);
    else showEmptyState();
  });
}

init();
