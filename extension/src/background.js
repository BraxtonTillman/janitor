// background.js - service worker
// Handles communication between content script and backend

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCORE_PR") {
    scorePR(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }
});

async function scorePR({ owner, repo, prNumber }) {
  const BACKEND_URL = "http://localhost:3000";
  const response = await fetch(
    `${BACKEND_URL}/api/score?owner=${owner}&repo=${repo}&pr=${prNumber}`
  );
  if (!response.ok) throw new Error("Backend request failed");
  return response.json();
}
