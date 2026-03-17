// scorer.js - core heuristics for AI-slop detection
// Each check returns a { flag, weight, detail } object

const GITHUB_API = "https://api.github.com";

async function fetchJSON(url) {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${url}`);
  return res.json();
}

export async function scorePR({ owner, repo, prNumber }) {
  const [pr, files] = await Promise.all([
    fetchJSON(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`),
    fetchJSON(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/files`),
  ]);

  const checks = [
    checkNoLinkedIssue(pr),
    checkGenericTitle(pr),
    checkLargeDiff(pr),
    checkNoTests(files),
    checkManyUnrelatedFiles(files),
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const maxWeight = checks.length * 10;
  const score = Math.round((totalWeight / maxWeight) * 100);

  return {
    score,        // 0-100, higher = more likely AI slop
    verdict: verdict(score),
    checks,
    meta: {
      title: pr.title,
      author: pr.user.login,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
    },
  };
}

function verdict(score) {
  if (score >= 70) return "🚨 Likely AI slop";
  if (score >= 40) return "⚠️  Suspicious";
  return "✅ Looks human";
}

// --- individual checks ---

function checkNoLinkedIssue(pr) {
  const body = pr.body || "";
  const hasLink =
    /(close[sd]?|fix(e[sd])?|resolve[sd]?)\s*#\d+/i.test(body) ||
    /github\.com\/.+\/issues\/\d+/.test(body);
  return {
    flag: "no_linked_issue",
    weight: hasLink ? 0 : 8,
    detail: hasLink ? "Links to an issue" : "No linked issue found",
  };
}

function checkGenericTitle(pr) {
  const generic = /^(fix|update|improve|add|remove|refactor|feat|chore)(\s*:|\s+\w+)?$/i;
  const isTooShort = pr.title.trim().length < 15;
  const isGeneric = generic.test(pr.title.trim());
  return {
    flag: "generic_title",
    weight: isTooShort || isGeneric ? 6 : 0,
    detail: isTooShort || isGeneric ? "Title is vague or too short" : "Title looks descriptive",
  };
}

function checkLargeDiff(pr) {
  const totalChanges = pr.additions + pr.deletions;
  const weight = totalChanges > 1000 ? 8 : totalChanges > 500 ? 5 : 0;
  return {
    flag: "large_diff",
    weight,
    detail: `${totalChanges} lines changed`,
  };
}

function checkNoTests(files) {
  const hasTest = files.some((f) => /test|spec|__tests__/.test(f.filename));
  return {
    flag: "no_tests",
    weight: hasTest ? 0 : 7,
    detail: hasTest ? "Includes test files" : "No test files found",
  };
}

function checkManyUnrelatedFiles(files) {
  const dirs = new Set(files.map((f) => f.filename.split("/")[0]));
  const weight = dirs.size > 5 ? 9 : dirs.size > 3 ? 5 : 0;
  return {
    flag: "many_unrelated_files",
    weight,
    detail: `Touches ${dirs.size} top-level director${dirs.size === 1 ? "y" : "ies"}`,
  };
}
