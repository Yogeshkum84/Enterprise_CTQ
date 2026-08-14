# Changelog — YK CTQ Audit Intelligence Platform

All notable changes are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning: [SemVer](https://semver.org/).

---

## [4.0.5] — 2026-05-08

**Stability & completeness patch.** All intelligence views fully wired; backend endpoints complete.

### Fixed
- **Excel import broken** — `readFile()` now detects `.xlsx` by filename and uses `FileReader.readAsArrayBuffer` + SheetJS `XLSX.read()` → `sheet_to_csv()`; CSV files continue to use `readAsText`
- **SheetJS CDN blocked** — SheetJS (`xlsx.full.min.js`) now served locally from `/js/` instead of cdnjs; no external dependency at runtime
- **`type="module"` breaking all event handlers** — removed `type="module"` from `app.js` script tag; all inline `onclick` handlers now resolve correctly
- **CTQ engine stub** — `scoreTicket()` was returning a hardcoded `overall_score: 87.5` for every ticket; replaced with full 42-criterion `_eval()` switch and real pillar aggregation
- **Dashboard showing 0 after processing** — results now auto-committed to `State.auditResults` immediately after `processBulkUpload()` completes; no longer requires manual "Save" click
- **Analytics empty after processing** — added `_persistBatchToBackend()` that POSTs scored tickets to `/api/audit/batch` after every upload, populating SQLite for Trends and Leaderboard
- **"Could not load HistoryManager"** — converted `history-manager.js` from ES module (`export`) to plain script (`window.HistoryManager`); added `<script>` tag to `index.html`; replaced all `import().then()` in `app.js` with direct `window.HistoryManager.*` calls
- **Automation Radar / Repeat Callers HistoryManager error** — resolved by same ES module → plain script conversion
- **`sqlite3.OperationalError: no such column`** — added safe `_add_column()` migration calls for `caller`, `category`, `resolution_code`, `assigned_to` on startup
- **GET `/api/patterns/notes/<id>` missing** — added single-pattern fetch endpoint (required by Edit modal)

### Added
- **`GET /api/logs`** — reads last N lines from `Logs/ctq.log*` with optional `level` filter (DEBUG / INFO / WARNING / ERROR); powers Execution Logs view
- **`GET /api/patterns/notes/<id>`** — fetch single note pattern by ID for edit pre-population
- **Execution Logs view** — live log viewer with colour-coded lines (ERROR=red, WARNING=amber, DEBUG=purple); level filter dropdown; auto-refresh
- **Note Patterns modal** — full popup for Add / Edit with CTQ criterion dropdown (all 42), category dropdown (12 ITIL), weak signal, coaching prompt, strong example fields
- **Coaching Plan view** — auto-generated per-agent coaching cards from `State.auditResults`; sorted worst-first; shows avg score, pass rate, top 3 failing criteria
- **Admin Panel** — full in-app editor for all 42 CTQ items (active toggle, weight, pillar), sentiment word lists, compliance threshold, org name
- **Daily log rotation** — `Logs/ctq.log` rotated at midnight, 30-day retention via `TimedRotatingFileHandler`

---

## [4.0.0] — 2026-05-07

**The Intelligence Edition.** Transforms the platform from a scoring tool into a full ITSM intelligence layer.

### Added — Interactive Historical Dashboard
- Plotly.js replaces static Canvas charts — zoom, pan, hover tooltips, download-as-PNG on every chart
- `/api/history/trends` endpoint — weekly CTQ score aggregations for up to 52 weeks
- `/api/history/agents` endpoint — per-agent performance summaries, paginated 20/page sorted worst-first
- `/api/history/anomalies` endpoint — statistical anomaly events (±1.5σ from rolling 8-week baseline)
- Time Series view and Agent Leaderboard view as new sidebar items
- Drill-Down Explorer — click chart bars/segments to filter the results table below
- `anomaly_flags` SQLite table

### Added — 7-Dimension Sentiment Engine
- `SentimentEngine` (Python) + `NLPEngine.analyseSentiment()` (JS) — identical output
- Dimensions: Polarity, Frustration Index, Escalation Urgency, VIP Sensitivity, SLA Anxiety, Resolution Confidence, Repeat Caller Signal (all 0–100)
- Frustration formula: `(caps_ratio×30 + negation_density×30 + repeat_phrases×20 + punctuation_score×20)`
- Radar/spider chart on ticket hover; frustration >70 or urgency >80 flagged 🔴 in results
- `/api/analyse/sentiment` — ad-hoc 7-dim analysis endpoint

### Added — Resolution Integrity Detector
- `ResolutionIntegrityEngine` — code-vs-notes Jaccard alignment + completeness + outcome verification
- Formula: `(jaccard×40 + completeness×35 + verification×25) → 0–100`
- `resolution_integrity` field in all score responses and `audit_tickets`

### Added — Categorisation Quality Scoring
- `CategoryQualityEngine` — keyword overlap cosine similarity
- `data/category_keywords_default.json` — ITIL cold-start map (12 categories, works from ticket #1)
- Flags possible mis-categorisation with `category_flag`, `category_suggestion`, and reason
- 🟡 icon in results table for flagged tickets

### Added — Work Note Enhancement Pattern Engine
- `NotePatternEngine` — matches weak-scoring note criteria to coaching prompts
- Pre-seeded with 24 patterns (Access, Hardware, Software, Network, Email, Printer) + 4 generic
- `/api/patterns/notes` CRUD (GET, POST, PUT, DELETE)
- Note Patterns sidebar view with category filter

### Added — FCR Detection
- Cross-references caller + category + date within a 7-day window against SQLite history
- `fcr_fail` field in all score responses; FCR Fail Rate in Agent Leaderboard

### Added — Repeat Caller Intelligence
- `repeat_callers` table rebuilt at each batch upload (30-day window, ≥3 appearances)
- `/api/repeat/callers` endpoint; Repeat Callers sidebar view; 🔁 badge in results table

### Added — Automation Radar
- Async K-means clustering (scikit-learn k=12) on ticket descriptions, runs in background thread
- `/api/automation/candidates` endpoint + Automation Radar sidebar view
- Graceful fallback when scikit-learn not installed

### Added — KB Health
- Extracts `KB\d+` citations from notes at batch time; `kb_citations` table
- `/api/kb/citations` endpoint; KB Health sidebar view

### Added — Files
- `js/history-manager.js` — Plotly chart rendering + history API fetching
- `js/nlp-engine.js` — client-side NLP mirror (sentiment, resolution integrity, category quality)
- `data/category_keywords_default.json` — ITIL keyword taxonomy
- `CHANGELOG.md`

### Changed
- `PyCTQEngine.score()` returns 9 additional fields (sentiment_profile, resolution_integrity, category_*, note_suggestions, fcr_fail)
- Batch endpoint stores new fields in SQLite, detects FCR, refreshes repeat callers, triggers async clustering
- `index.html` — version 4.0.0; Plotly CDN added; 6 new sidebar nav items in 2 new sections
- `js/app.js` — `switchView()` handles 5 new views; results table shows v4.0 columns
- `requirements.txt` — added `scikit-learn>=1.3` and `numpy>=1.26` (optional)
- `.github/workflows/ci.yml` — 5 new test steps covering all v4.0 engines

### Fixed
- `audit_tickets` INSERT now persists `caller`, `category`, `resolution_code`, `assigned_to` (required for FCR + repeat caller detection)

---

## [3.0.0] — 2026-04

**The Enterprise Edition.** Initial public release.

### Added
- 42-criterion CTQ scoring engine (JavaScript + Python mirror)
- 8 Quality Pillars
- Batch CSV processing (up to 5,000 tickets)
- SQLite persistence (`audit_batches` + `audit_tickets`)
- Web Worker for non-blocking large batch processing
- SHA-256 password hashing
- CSV + PDF export with YK branding
- Dark-theme enterprise UI
- Flask backend with REST API at port 8745
- MIT Licence, CONTRIBUTING.md, `.gitignore`, GitHub Actions CI

---

*YK CTQ Audit Intelligence Platform — MIT Licensed — [github.com/Yogeshkum84/ctq-enterprise](https://github.com/Yogeshkum84/ctq-enterprise)*

## [3.0.0] — 2026-04-14  *(Initial public release)*

### Added
- Full Python scoring backend (`PyCTQEngine`) in `server.py` — all 42 CTQ criteria, identical logic to the JS engine.
- Batch scoring API endpoint (`POST /api/audit/batch`) supporting up to 5,000 tickets per call.
- SQLite persistence (`data/ctq_history.db`) for week-over-week trend tracking.
- Trend API endpoint (`GET /api/trends`) returning last 52 batch summaries.
- Hashed credentials replacing plaintext passwords in the Flask auth layer.
- MIT licence, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG.
- GitHub Actions CI workflow (Python 3.10–3.12, Ubuntu/Windows/macOS).
- Donation QR code and Sponsor button (FUNDING.yml).

### Existing (pre-public)
- 42-criterion JavaScript scoring engine (`js/scoring-engine.js`).
- 8-pillar quality framework configured in `js/config-manager.js`.
- Multi-view enterprise UI: Dashboard, New Audit, Audit Results, Trends, Coaching Plan, Quality Pillars, Admin Panel, Execution Logs.
- CSV and PDF export (`js/export-manager.js`).
- LocalStorage-based config persistence.
- Web Worker processing for non-blocking large-batch scoring in the browser.
