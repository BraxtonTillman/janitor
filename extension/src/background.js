// background.js - service worker
// Relays scoring to the backend and performs GitHub API triage when a token exists.

const BACKEND_URL = "http://localhost:3000";
const GITHUB_API = "https://api.github.com";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCORE_PR") {
    scorePR(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "SCORE_PR_BATCH") {
    scorePRBatch(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "GITHUB_TRIAGE") {
    githubTriage(message.action, message.payload)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({ error: err.message, fallbackUrl: err.fallbackUrl })
      );
    return true;
  }
});

async function getGithubToken() {
  const { githubToken } = await chrome.storage.sync.get("githubToken");
  return githubToken || undefined;
}

async function scorePR({ owner, repo, prNumber }) {
  const githubToken = await getGithubToken();
  const headers = { Accept: "application/json" };
  if (githubToken) headers["x-github-token"] = githubToken;
  const response = await fetch(
    `${BACKEND_URL}/api/score?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&pr=${encodeURIComponent(prNumber)}`,
    { headers }
  );
  if (!response.ok) throw new Error("Backend request failed");
  return response.json();
}

async function scorePRBatch({ owner, repo, prNumbers }) {
  const githubToken = await getGithubToken();
  const headers = { Accept: "application/json" };
  if (githubToken) headers["x-github-token"] = githubToken;
  const out = {};
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < prNumbers.length; i++) {
    const pr = prNumbers[i];
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/score?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&pr=${encodeURIComponent(pr)}`,
        { headers }
      );
      if (response.ok) out[pr] = await response.json();
      else out[pr] = { error: `HTTP ${response.status}` };
    } catch (e) {
      out[pr] = { error: e.message || "failed" };
    }
    if (i < prNumbers.length - 1) await delay(150);
  }
  return out;
}

function ghHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
}

async function githubTriage(action, { owner, repo, prNumber }) {
  const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  const token = await getGithubToken();
  if (!token) {
    return {
      ok: false,
      usedApi: false,
      fallbackUrl: triageFallbackUrl(action, owner, repo, prNumber),
    };
  }

  const err = (fallbackUrl) => {
    const e = new Error("GitHub API request failed");
    e.fallbackUrl = fallbackUrl;
    throw e;
  };

  try {
    if (action === "label_ai") {
      const res = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/labels`,
        {
          method: "POST",
          headers: { ...ghHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({ labels: ["AI-generated"] }),
        }
      );
      if (res.ok) return { ok: true, usedApi: true };
      if (res.status === 404 || res.status === 422) {
        const create = await fetch(
          `${GITHUB_API}/repos/${owner}/${repo}/labels`,
          {
            method: "POST",
            headers: { ...ghHeaders(token), "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "AI-generated",
              color: "5319E7",
              description: "Flagged by Janitor extension",
            }),
          }
        );
        if (create.ok) {
          const again = await fetch(
            `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/labels`,
            {
              method: "POST",
              headers: {
                ...ghHeaders(token),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ labels: ["AI-generated"] }),
            }
          );
          if (again.ok) return { ok: true, usedApi: true };
        }
      }
      err(prUrl);
    }
    if (action === "close") {
      const res = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          method: "PATCH",
          headers: { ...ghHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({ state: "closed" }),
        }
      );
      if (res.ok) return { ok: true, usedApi: true };
      err(prUrl);
    }
    if (action === "approve") {
      const res = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
        {
          method: "POST",
          headers: { ...ghHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({ event: "APPROVE" }),
        }
      );
      if (res.ok) return { ok: true, usedApi: true };
      err(prUrl);
    }
    throw new Error("Unknown triage action");
  } catch (e) {
    if (e.fallbackUrl) throw e;
    err(triageFallbackUrl(action, owner, repo, prNumber));
  }
}

function triageFallbackUrl(_action, owner, repo, prNumber) {
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}
