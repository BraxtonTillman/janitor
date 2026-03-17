// content.js - injected into GitHub PR pages
// Parses the current URL and triggers PR scoring

(function () {
  const match = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!match) return;

  const [, owner, repo, prNumber] = match;

  // TODO: inject sidebar UI here (next milestone)
  console.log(`[Janitor] PR detected: ${owner}/${repo}#${prNumber}`);

  chrome.runtime.sendMessage(
    { type: "SCORE_PR", payload: { owner, repo, prNumber } },
    (response) => {
      if (response?.error) {
        console.error("[Janitor] Scoring failed:", response.error);
        return;
      }
      console.log("[Janitor] Score result:", response);
      // TODO: render score in sidebar
    }
  );
})();
