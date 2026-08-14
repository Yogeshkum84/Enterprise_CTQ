<!-- markdownlint-disable MD033 MD041 -->
<h1 align="center">YK CTQ Audit Intelligence Platform</h1>
<p align="center"><em>Enterprise Edition &nbsp;v4.0.0</em></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
  <a href="#"><img alt="Python" src="https://img.shields.io/badge/python-3.10%2B-blue.svg"></a>
  <a href="#"><img alt="Status" src="https://img.shields.io/badge/status-stable-brightgreen.svg"></a>
  <a href="#-support-this-project"><img alt="Donate" src="https://img.shields.io/badge/%E2%9D%A4%20support-buy%20me%20a%20coffee-ff69b4"></a>
</p>

<p align="center">
  A <strong>local-first, offline-capable</strong> enterprise platform for auditing ServiceNow ITSM ticket quality —<br>
  Incidents, Requests, Tasks and Changes — against a rigorous <strong>42-criterion CTQ framework</strong>.
</p>

---

## ✨ What's new in v4.0

v4.0 is a complete architectural overhaul — the scoring engine, persistence layer, analytics, and intelligence features are all new.

| Area | Change |
|---|---|
| **Excel import** | Upload `.xlsx` files directly — SheetJS converts to CSV in-browser, no server round-trip |
| **Dual-engine scoring** | 42-criterion engine runs in both Python (backend) and JavaScript (browser) for full offline support |
| **SQLite persistence** | All audited tickets, batches, and history stored in `data/ctq_history.db` — survives server restarts |
| **Trends & History** | Week-over-week quality trends with Plotly interactive charts; agent-level time series |
| **Agent Leaderboard** | Ranked performance table with pass rate, avg score, top failure criteria, sortable columns |
| **Coaching Plan** | Auto-generated per-agent coaching notes derived from lowest-scoring CTQ criteria |
| **Note Pattern Library** | CRUD library of CTQ criterion → weak signal → strong example patterns; editable via modal popup |
| **Automation Radar** | ML-powered clustering (scikit-learn k-means, optional) identifies automation candidates by ticket type |
| **Repeat Callers** | Detects customers calling multiple times on the same issue — FCR failure signal |
| **KB Health** | Tracks KB article citation frequency from work notes — surfaces stale or over-relied-on articles |
| **Admin Panel** | Full in-app configuration of all 42 CTQ items (active/inactive, weight, pillar), sentiment word lists, org settings |
| **Execution Logs** | Live log viewer — reads rotating daily log files from `Logs/` folder with level filtering |
| **Daily log rotation** | `Logs/ctq-YYYY-MM-DD.log` files, 30-day retention, colour-coded in the Logs view |

---

## ✨ Full feature list

| Capability | Detail |
|---|---|
| **42-Criterion CTQ scoring** | Weighted heuristics across 8 quality pillars — transparent, explainable, customisable |
| **Excel & CSV import** | Upload `.xlsx` or `.csv` exports from ServiceNow — scored in seconds in the browser |
| **Sentiment analysis** | Positive / Neutral / Negative tone detection on work notes and comments |
| **8 Quality Pillars** | Continuous Improvement · Consistent Quality · Compliance · Training & Coaching · CSAT/Retention · Objective Evaluation · Productivity · Risk Management |
| **Dashboard** | Live stats — ticket count, avg score, pass rate, sentiment breakdown, pillar radar |
| **Trends & History** | Interactive Plotly charts — score over time, pillar trends, week-over-week delta |
| **Agent Leaderboard** | Ranked table with pass rate, avg score, top failure reasons |
| **Coaching Plan** | Per-agent summaries with their worst CTQ criteria and improvement prompts |
| **Quality Pillars** | Breakdown view per pillar with criterion-level drill-down |
| **Note Pattern Library** | Add / edit / delete coaching patterns tied to specific CTQ criteria |
| **Automation Radar** | Identifies high-frequency, low-variation ticket clusters as automation candidates |
| **Repeat Callers** | Surfaces customers with ≥2 tickets for the same issue — FCR failure signal |
| **KB Health** | Citation frequency for KB articles mentioned in work notes |
| **Admin Panel** | Edit all 42 CTQ items, sentiment word lists, compliance threshold, org settings |
| **Execution Logs** | Live log viewer with DEBUG / INFO / WARNING / ERROR filtering |
| **Export** | CSV (all 42 scores + raw fields) or print-ready PDF report |
| **Local auth** | Username/password login — no external identity provider needed |
| **100% offline** | Runs entirely on your machine — no cloud, no telemetry, no data leaves the box |

---

## 🖥️ Navigation

After starting the server, open `http://localhost:8745`.

| Section | View | Description |
|---|---|---|
| **Operations** | Dashboard | Live KPIs, pillar radar, sentiment summary |
| | New Audit | Upload CSV / Excel, review results, auto-saved to history |
| | Audit Results | Searchable table of all processed tickets |
| **Analytics** | Trends & History | Week-over-week score trends, agent time series |
| | Agent Leaderboard | Ranked performance — sortable by score, pass rate, tickets |
| | Coaching Plan | Auto-generated per-agent improvement guide |
| | Quality Pillars | Pillar breakdown with criterion drill-down |
| **Intelligence** | Note Patterns | Library of weak-signal → coaching prompt patterns |
| | Automation Radar | ML-identified automation candidates |
| | Repeat Callers | FCR failure detection |
| | KB Health | KB article citation health |
| **System** | Admin Panel | CTQ item config, sentiment lists, org settings *(admin only)* |
| | Execution Logs | Live server log viewer *(admin only)* |
| | Export Report | Download CSV or PDF |

---

## 🚀 Quick start

### Prerequisites

- Python 3.10 or later
- A modern browser (Chrome / Edge / Firefox)
- *(Optional)* `scikit-learn` — enables ML clustering in Automation Radar

### 1 — Clone and install

```bash
git clone https://github.com/Yogeshkum84/ctq-enterprise.git
cd ctq-enterprise

# Windows
python -m venv .venv && .venv\Scripts\activate

# macOS / Linux
python -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt

# Optional — enables Automation Radar ML clustering
pip install scikit-learn
```

### 2 — Start the server

```bash
python server.py
```

The server starts on port **8745** and logs to both the console and `Logs/ctq.log`.

### 3 — Open in browser

Navigate to **http://localhost:8745**

Default credentials:

| Username | Password | Role |
|---|---|---|
| `admin` | (configured via `.env` / production) | Administrator |
| `user` | `user123` | Standard user |

> **Change these before sharing the folder with colleagues.** Edit the `USERS` dict near the top of `server.py`.

---

## 📂 Project structure

```
CTQ-Enterprise/
├── index.html               ← App shell (login + main layout)
├── server.py                ← Flask backend + Python CTQ engine + all API routes
├── requirements.txt
│
├── js/
│   ├── app.js               ← UI controller, view router, 42-criterion JS engine
│   ├── history-manager.js   ← Plotly chart renderers (Trends, Leaderboard, Radar…)
│   └── xlsx.full.min.js     ← SheetJS — Excel parsing (local copy, no CDN required)
│
├── css/
│   ├── main.css             ← Layout, dark theme, header/footer
│   └── components.css       ← Buttons, cards, modals, tables, badges
│
├── assets/
│   └── logo.svg             ← YK brand logo
│
├── data/                    ← Created at runtime — contains ctq_history.db (SQLite)
│
├── Logs/                    ← Created at runtime — rotating daily log files
│   └── ctq.log              ← Current day's log (rotated to ctq.log.YYYY-MM-DD)
│
└── docs/
    ├── APPROACH.md          ← 42-criterion model rationale
    ├── V4_DESIGN.md         ← v4.0 architecture decisions
    └── DATA_DICTIONARY.md   ← ServiceNow field mapping
```

---

## 📥 Preparing your ServiceNow export

The platform expects a CSV (or Excel) export with these columns. Column names are matched case-insensitively.

| Field | ServiceNow column | Required |
|---|---|---|
| `number` | Number | ✅ |
| `short_description` | Short description | ✅ |
| `description` | Description | — |
| `category` | Category | — |
| `subcategory` | Subcategory | — |
| `priority` | Priority | — |
| `state` | State | — |
| `resolution_notes` | Resolution notes / Close notes | — |
| `work_notes` | Work notes | — |
| `assigned_to` | Assigned to | — |
| `assignment_group` | Assignment group | — |
| `caller` | Caller | — |
| `resolution_code` | Resolution code | — |
| `opened_at` | Opened | — |
| `resolved_at` | Resolved | — |
| `ticket_type` | *(add as literal column)* | — |

Any extra columns are ignored. At minimum `number` and `short_description` are required for scoring — all other fields enrich the score.

---

## ⚙️ Configuration

### In-app (Admin Panel)

- Toggle any of the 42 CTQ items on or off
- Adjust the weight (0–3) and pillar assignment for each criterion
- Edit the positive / negative sentiment word lists
- Set the compliance pass/fail threshold (default 70)
- Configure your organisation name shown on exported reports

Changes are saved to `localStorage` and persist between sessions. Click **Reset Config** to restore defaults.

### Server-side

Edit `server.py` directly for:

- **Users** — `USERS` dict at the top of the file
- **Port** — `app.run(port=8745, ...)` at the bottom
- **Log retention** — `backupCount=30` in the `TimedRotatingFileHandler` setup

---

## 🗄️ Data & privacy

- All ticket data is processed **locally** — nothing is sent to any external service.
- Ticket rows are stored in `data/ctq_history.db` (SQLite, self-contained).
- Server logs are written to `Logs/` and rotated daily; 30 days of history is kept.
- The only outbound request is to `cdn.plot.ly` when charts render. This can be replaced with a local Plotly build for fully air-gapped deployments.

---

## 🗃️ Database schema

The SQLite database at `data/ctq_history.db` contains the following tables:

| Table | Purpose |
|---|---|
| `audit_batches` | One row per uploaded file — timestamp, row count, avg score, pass rate |
| `audit_tickets` | One row per scored ticket — all 42 CTQ scores stored as JSON in `ctq_scores` |
| `note_patterns` | Note pattern library — criterion, weak signal, coaching prompt, strong example |
| `repeat_callers` | Aggregated repeat-caller counts |
| `automation_clusters` | ML clustering results for Automation Radar |
| `kb_citations` | KB article mentions extracted from work notes |

---

## 🧪 API reference

All endpoints are served by the Flask backend on port 8745.

### Health & system

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Platform status, version, DB path, sklearn availability |
| GET | `/api/logs` | Last N log lines — params: `lines` (default 200), `level` (ALL/DEBUG/INFO/WARNING/ERROR) |

### Audit

| Method | Path | Description |
|---|---|---|
| POST | `/api/audit/score` | Score a single ticket (JSON body) |
| POST | `/api/audit/batch` | Persist a batch of pre-scored tickets from the browser |
| GET | `/api/history/batches` | List all uploaded batches |
| GET | `/api/history/agents` | Agent-level aggregated stats |
| GET | `/api/history/tickets` | Paginated ticket list — params: `batch_id`, `limit`, `offset` |
| GET | `/api/history/agent/<name>` | Time-series scores for a specific agent |
| GET | `/api/trends` | Week-by-week summary (legacy compat) |

### Intelligence

| Method | Path | Description |
|---|---|---|
| GET | `/api/automation/candidates` | Automation Radar clusters |
| GET | `/api/repeat/callers` | Repeat caller list |
| GET | `/api/kb/citations` | KB article citation counts |
| GET | `/api/sentiment` | Sentiment analysis on supplied text (param: `text`) |

### Note patterns

| Method | Path | Description |
|---|---|---|
| GET | `/api/patterns/notes` | List all patterns (optional `category` filter) |
| GET | `/api/patterns/notes/<id>` | Fetch a single pattern by ID |
| POST | `/api/patterns/notes` | Create a new pattern |
| PUT | `/api/patterns/notes/<id>` | Update an existing pattern |
| DELETE | `/api/patterns/notes/<id>` | Delete a pattern |

### Example curl calls

```bash
# Health check
curl http://localhost:8745/api/health

# Score a single ticket
curl -X POST http://localhost:8745/api/audit/score \
  -H "Content-Type: application/json" \
  -d '{
    "short_description": "Printer jam on floor 3",
    "description": "User reports printer jammed",
    "category": "Hardware",
    "priority": "3 - Moderate",
    "state": "Resolved",
    "resolution_notes": "Toner replaced and confirmed working",
    "assignment_group": "EUC"
  }'

# Last 50 WARNING+ log lines
curl "http://localhost:8745/api/logs?lines=50&level=WARNING"

# List all note patterns
curl http://localhost:8745/api/patterns/notes

# Get automation radar candidates
curl http://localhost:8745/api/automation/candidates
```

---

## 🧠 The 42-Criterion CTQ Framework

Scores are calculated by a heuristic engine that evaluates each ticket against 42 criteria grouped into 8 quality pillars. Every criterion contributes a weighted pass/fail signal; the pillar score is the weighted average of its criteria; the overall score is the weighted average of all 8 pillars.

| Pillar | Example criteria |
|---|---|
| **Compliance** | SLA met, priority accuracy, correct closure code |
| **Consistent Quality** | Description completeness, resolution detail, note frequency |
| **Continuous Improvement** | Root cause documented, knowledge article linked |
| **Training & Coaching** | Category correctness, escalation appropriateness |
| **CSAT / Retention** | Sentiment positive, repeat contact avoided |
| **Objective Evaluation** | Assignment group correct, ticket type accurate |
| **Productivity** | Resolution speed relative to priority |
| **Risk Management** | Critical tickets escalated, security categories handled |

See [docs/APPROACH.md](docs/APPROACH.md) for the full criterion list with weights and rationale.

---

## 🛣️ Roadmap

- Power BI `.pbit` template bound to the SQLite trend store
- Multi-user JWT authentication with RBAC (read-only analyst role)
- Pluggable NLP backend (sentence-transformers) for semantic note similarity
- Docker packaging for team deployments
- Webhook integration — push audit results to Slack / Teams on completion

---

## 🤝 Contributing

Issues, feature requests and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) first.

---

## 📄 License

[MIT](LICENSE) — free for personal and commercial use. Attribution appreciated.

---

## ❤️ Support this project

If the tool saves you time in your QA workflow, a small donation keeps the development going. Completely optional — thank you!

<table align="center">
  <tr>
    <td align="center">
      <a href="docs/donate-qr.png">
        <img src="docs/donate-qr.png" alt="Scan to donate" width="180" />
      </a>
      <br/><sub>Scan with your banking app</sub>
    </td>
    <td align="center" style="padding-left:24px">
      <a href="https://monzo.me/yogeshkumar36?h=_Ye7K0">
        <img alt="Buy me a coffee" src="https://img.shields.io/badge/%E2%98%95%20Buy%20me%20a%20coffee-Donate%20via%20Monzo-ff5e5b?style=for-the-badge" />
      </a>
      <br/><br/>
      <sub>Any amount appreciated 🙏</sub>
    </td>
  </tr>
</table>

---

*Developed by **Yogesh K** · Enterprise IT Quality Engineering*
