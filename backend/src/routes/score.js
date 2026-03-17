import express from "express";
import { scorePR } from "../services/scorer.js";

const router = express.Router();

// GET /api/score?owner=&repo=&pr=
router.get("/", async (req, res) => {
  const { owner, repo, pr } = req.query;
  if (!owner || !repo || !pr) {
    return res.status(400).json({ error: "Missing owner, repo, or pr param" });
  }
  try {
    const githubToken = req.get("x-github-token") || undefined;
    const result = await scorePR({
      owner,
      repo,
      prNumber: pr,
      githubToken,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scoring failed", details: err.message });
  }
});

export default router;
