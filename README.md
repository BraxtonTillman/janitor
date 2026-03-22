# 🧹 Janitor

A Chrome extension + backend that helps FOSS maintainers triage AI-generated PRs.

## Demo

[![Janitor extension demo — watch on YouTube](https://img.youtube.com/vi/JH1yUufWdt4/maxresdefault.jpg)](https://youtu.be/JH1yUufWdt4)

## Project Structure

```text
janitor/
├── extension/          # Chrome extension
│   ├── manifest.json
│   ├── src/
│   │   ├── background.js   # service worker, talks to backend
│   │   ├── content.js      # injected into GitHub PR pages
│   │   ├── popup.html      # extension popup
│   │   └── popup.js
│   ├── styles/
│   │   └── janitor.css
│   └── icons/              # add icon PNGs here (16, 48, 128px)
│
└── backend/            # Node.js scoring API
    ├── package.json
    ├── .env.example
    └── src/
        ├── index.js        # Express server
        ├── routes/
        │   └── score.js    # GET /api/score
        └── services/
            └── scorer.js   # heuristics engine
```

## Getting Started

### Backend

```bash
cd backend
npm install
cp .env.example .env      # add your GitHub PAT
npm run dev               # runs on http://localhost:3000
```

### Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder
4. Navigate to any GitHub PR — open the console to see Janitor output

## Heuristics (current)

| Check | Weight |
| --- | --- |
| No linked issue | 8 |
| Generic/short title | 6 |
| Large diff (500+ lines) | 5–8 |
| No test files | 7 |
| Touches many unrelated directories | 5–9 |

Score is 0–100. **≥70 = likely AI slop, 40–69 = suspicious, <40 = looks human.**

## Roadmap

- [ ] Sidebar UI overlay on GitHub PR pages
- [ ] One-click triage toolbar (label, close, approve)
- [ ] PR queue view on repo pages
- [ ] Janitor reputation/rating system
- [ ] Sponsor funding layer
