# YK CTQ Audit Intelligence Platform — v4.0 Design Specification

**Status:** Pre-implementation design  
**Author:** Yogesh K  
**Based on:** Market research (2025–2026), existing v3.0 codebase audit, NLP/ITSM literature review  
**Date:** May 2026

---

## 1. Executive Summary

Version 4.0 transforms the platform from a **scoring tool** into a full **ITSM intelligence layer**. The six v3.0 gaps identified by market research — interactive history, deep sentiment, work note coaching, categorisation quality, resolution integrity, and automation signals — are all blind spots that no vendor has fully closed in a local-first, free product. This spec defines how to close them.

**Core philosophy stays the same:** everything runs offline, no data leaves the machine, every score is explainable, and the UI is a single browser tab.

---

## 2. Gap Analysis — v3.0 vs Market

| Dimension | v3.0 | Market Leaders (2026) | v4.0 Target |
|---|---|---|---|
| Historical reporting | localStorage only, no drill-down | Multi-level drill-down, trend anomaly alerts | SQLite-backed interactive charts, anomaly surface |
| Sentiment | 3-level pos/neg/neutral word count | 5-level, frustration/urgency/VIP detection | 7-dimension sentiment engine |
| Work note coaching | Generic coaching notes | AI-suggested note templates per issue type | Pattern library + per-issue enhancement prompts |
| Categorisation quality | Not measured | Confidence scoring, mis-route detection | Heuristic + TF-IDF confidence scorer |
| Resolution integrity | Not measured | Mismatch detection (emerging) | Code-vs-notes Jaccard mismatch detector |
| Automation signals | Not present | 30–50% of tickets flagged | Cluster-based automation candidates view |
| FCR (First Contact) | Not tracked | Core KPI in every leading tool | FCR detection from ticket reopening patterns |
| Repeat caller | Not tracked | Proactive intervention trigger | Caller history frequency flag |

---

## 3. Feature Specifications

### 3.1 — Interactive Historical Dashboard

**Problem:** Results are in localStorage only. No trend charts persist across sessions. No drill-down.

**Design:**

The backend SQLite store already tracks `audit_batches` and `audit_tickets`. v4.0 adds:

- A `/api/history/*` endpoint family that serves pre-aggregated trend data by week, category, agent, pillar, and ticket type.
- The frontend replaces raw Canvas charts with **Plotly.js** (loaded from CDN, or inlined for offline). Plotly gives zoom, pan, hover tooltips, and download-as-PNG out of the box.
- **Three new dashboard tabs:**
  - **Time Series** — score trend per week with anomaly flags (±1.5σ from rolling 8-week mean).
  - **Agent Leaderboard** — per-agent average score, trend arrow, worst criterion highlighted.
  - **Drill-Down Explorer** — click any bar/line to filter the results table beneath it. Filters are composable (ticket type + date range + score band).

**Anomaly detection (server-side):**

```
For each week w:
  rolling_mean = avg(score[w-8 .. w-1])
  rolling_std  = std(score[w-8 .. w-1])
  if score[w] < rolling_mean - 1.5 * rolling_std → flag RED
  if score[w] > rolling_mean + 1.5 * rolling_std → flag GREEN (positive anomaly)
```

Anomalies are stored in a new `anomaly_flags` table and surfaced as annotation markers on the time-series chart with a tooltip explaining the trigger.

**New SQLite tables needed:**

```sql
CREATE TABLE agent_summaries (
    week_start   TEXT,
    agent_name   TEXT,
    ticket_count INTEGER,
    avg_score    REAL,
    worst_criterion TEXT,
    fcr_rate     REAL,
    PRIMARY KEY (week_start, agent_name)
);

CREATE TABLE anomaly_flags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start  TEXT,
    metric      TEXT,   -- 'avg_score', 'pass_rate', 'fcr_rate', etc.
    direction   TEXT,   -- 'drop' | 'spike'
    value       REAL,
    baseline    REAL,
    sigma_delta REAL,
    created_at  TEXT
);
```

---

### 3.2 — Enhanced Multi-Dimensional Sentiment Engine

**Problem:** v3.0 sentiment is a single word-count pass returning Positive/Neutral/Negative.

**Design — 7 sentiment dimensions:**

| Dimension | Signal source | Detection method |
|---|---|---|
| **Polarity** | All text fields | Weighted word-count (existing) → upgraded to bigram lexicon |
| **Frustration index** | Caller comments, work notes | Negation density, ALL-CAPS ratio, repeat phrases, punctuation intensity |
| **Escalation urgency** | Short description, comments | Urgency keywords + time-pressure phrases + priority mismatch |
| **VIP sensitivity** | Caller field, description | VIP markers + seniority title detection |
| **SLA anxiety** | Comments + opened/due dates | "deadline", "breach", "still waiting" patterns + time-to-due proximity |
| **Resolution confidence** | Resolution notes | Hedge words ("should be", "might", "hopefully") vs. certainty language |
| **Repeat-caller signal** | Caller field × history | Count of same caller in last 30 days from SQLite history |

**Scoring:**

Each dimension returns a 0–100 score. The combined `sentiment_profile` object is stored as JSON in `audit_tickets.sentiment_profile`.

**Frustration index formula:**

```
caps_ratio        = UPPERCASE_chars / total_chars
negation_density  = count(not|never|still|no|cannot|won't) / word_count
repeat_phrases    = count of phrases appearing ≥2× in same note
punctuation_score = count('!', '???', '...') / sentence_count

frustration = (caps_ratio×30 + negation_density×30 + repeat_phrases×20 + punctuation_score×20)
            clamped to 0–100
```

**UI change:** The "Sentiment Breakdown" card on the dashboard becomes a **radar/spider chart** with 7 axes. Hovering a ticket in the results table shows its sentiment profile as a mini-radar. Tickets with frustration > 70 or escalation urgency > 80 get a 🔴 flag in the results list.

**New API endpoint:** `POST /api/analyse/sentiment` — accepts raw text, returns all 7 scores. Useful for ad-hoc analysis.

---

### 3.3 — Work Note Enhancement Pattern Engine

**Problem:** Coaching notes are generic ("Focus coaching on Criterion 3"). Teams need specific, actionable suggestions per issue type.

**Design — three components:**

#### A. Pattern Library (server-side JSON, editable by admin)

A curated library of `(issue_category, pattern_name, weak_signal, strong_example)` tuples stored in a new `note_patterns` SQLite table and editable via Admin Panel.

**Example entries:**

| Category | Weak signal | Enhancement prompt | Strong example |
|---|---|---|---|
| Access | "reset done" | Add: who requested, what system, verification step | "Reset AD password per caller request for [system]. Tested: user confirmed login successful via Teams call." |
| Hardware | "replaced part" | Add: part number, fault symptom, test outcome | "Replaced toner cartridge (CLT-K504S). Original fault: paper jam + faint print. Post-fix: test page printed cleanly." |
| Network | "checked network" | Add: tool used, test output, scope of impact | "Ran ping/tracert to 8.8.8.8. Packet loss 30% on switch port 14. Isolated to single port — remapped to port 15. User confirmed connectivity restored." |
| Software | "reinstalled app" | Add: version before/after, root cause, prevention | "Uninstalled Outlook v16.0.12 (corrupt profile). Clean install v16.0.17. Root cause: profile corruption after Windows Update KB5034441. User educated on not closing during updates." |

#### B. Per-ticket enhancement suggestions

After scoring, `PyCTQEngine` now runs a second pass:

1. Identify the ticket's `category` and `subcategory`.
2. Check which note quality criteria scored < 60 (Criterion 3, 10, 11, 19, 25, 28, 41).
3. Look up matching patterns from the library.
4. Return 2–4 specific enhancement prompts as `note_suggestions[]`.

**API addition to `/api/audit/score` response:**

```json
{
  "overall_score": 61.2,
  "note_suggestions": [
    {
      "criterion": "Work Notes Documentation",
      "current_weakness": "Note is under 10 words — missing context",
      "prompt": "Add: what action was taken, what tool/system was touched, and what the user confirmed",
      "example": "Restarted Print Spooler service on user's PC (hostname: WKST-042). Tested: user printed test page successfully."
    }
  ]
}
```

#### C. Work Note Pattern Analysis view (new sidebar section)

A new view — **Note Patterns** — that runs at batch level:

- Groups all low-scoring work notes (Criterion 3 < 60) by category.
- Clusters them using TF-IDF + K-means to find common weak patterns.
- Presents: "Your Access tickets most commonly have vague work notes. Top missing elements: verification step (82%), system name (67%)."
- Provides a downloadable **pattern report** (Markdown/PDF) for use in team training.

---

### 3.4 — Categorisation Quality Scoring

**Problem:** The system scores whether a category *exists* (Criterion 1 = binary). It doesn't detect if it is *wrong*.

**Design — confidence-based mis-categorisation detector:**

**Approach (local, no ML training needed initially):**

1. Build a `category_keyword_map` from the historical SQLite store — for each category, collect the TF-IDF top-20 terms from tickets assigned to it.
2. For a new ticket, vectorise its `short_description + description` and compare cosine similarity against each category's centroid.
3. If the assigned category's similarity < 0.4, or if a different category scores > 0.2 higher → flag as **possible miscategorisation**.

**Output fields added to score response:**

```json
{
  "category_confidence": 0.72,
  "category_suggestion": null,
  "category_flag": false
}
```

Or when confidence is low:

```json
{
  "category_confidence": 0.31,
  "category_suggestion": "Software",
  "category_flag": true,
  "category_flag_reason": "Ticket text is 4× more similar to 'Software' tickets than to assigned category 'Hardware'"
}
```

**UI:** Category cells in the results table show a 🟡 warning icon when flagged. A new **Categorisation Quality** section on the dashboard shows: % correctly categorised, top miscategorised pairs (e.g., "Access → Software: 34 tickets"), and a heatmap of category confusion.

**Cold-start (no history yet):** Use a built-in keyword map derived from ITIL taxonomy as a fallback. Admin can train/update it via the Admin Panel once enough tickets are stored.

---

### 3.5 — Resolution Code vs. Resolution Quality Detector

**Problem:** Agents close tickets with a standard code ("Resolved by IT") while the notes tell a completely different story — or nothing at all.

**Design — mismatch scoring:**

**Three dimensions of resolution integrity:**

| Check | What it detects | Scoring |
|---|---|---|
| **Code–Note alignment** | Resolution code implies action not reflected in notes | Jaccard similarity between code-implied terms and notes keywords |
| **Completeness** | Closed/Resolved ticket with empty or vague resolution notes | Word-count + action verb detection |
| **Outcome verification** | Whether the technician confirmed the fix worked with the user | Presence of confirmation patterns |

**Code-implied term map:**

```python
RESOLUTION_CODE_TERMS = {
    "Resolved by IT":         ["fix", "resolved", "corrected", "repaired", "restored", "tested", "confirmed"],
    "Resolved by caller":     ["user", "caller", "self", "themselves", "independently"],
    "User education":         ["explained", "trained", "showed", "guided", "educated", "documented"],
    "Workaround provided":    ["workaround", "temporary", "interim", "alternative"],
    "No fault found":         ["tested", "checked", "verified", "no issue", "unable to reproduce"],
    "Third party":            ["vendor", "supplier", "third party", "escalated", "external"],
    "Duplicate":              ["duplicate", "existing", "same", "already logged"],
}
```

**Mismatch score formula:**

```
note_terms   = TF-IDF top-10 keywords from resolution_notes
code_terms   = RESOLUTION_CODE_TERMS[resolution_code]
jaccard      = |note_terms ∩ code_terms| / |note_terms ∪ code_terms|
completeness = min(1.0, word_count(resolution_notes) / 20)
verification = 1 if confirmation pattern in notes else 0

resolution_integrity = (jaccard×40 + completeness×35 + verification×25) → 0–100
```

**New Criterion 41 sub-scoring:** The existing Criterion 41 ("Inefficient Resolution") absorbs this as three sub-dimensions, making it more granular without changing the overall weighting.

**UI addition:** A new **Resolution Integrity** panel in the Audit Results view shows:
- Integrity score per ticket with colour banding.
- A "Resolution Mismatch" filter in the results table.
- A summary card: "47 tickets had a resolution code that did not match the resolution notes."

---

### 3.6 — Market-Driven Additional Enhancements

Research identified four areas where the market is moving that v4.0 should incorporate:

#### A. First Contact Resolution (FCR) Tracking

**What:** Whether the same caller/issue recurred within 7 days of closure.

**How:** On each batch load, the backend cross-references `caller` + `category` combinations against prior tickets in SQLite within a 7-day window. Tickets where a recurrence is detected get `fcr_fail = true`.

**Dashboard KPI:** FCR rate joins the existing 4-KPI header row, making it a 5-KPI row: Total Audited, Avg CTQ Score, Compliance Rate, SLA at Risk, **FCR Rate**.

#### B. Automation Candidate Identification

**What:** Surface ticket clusters that are high-volume, low-complexity, and repeating — the prime targets for self-service or chatbot automation.

**How:** Run K-means (k=12) on TF-IDF vectors of `short_description + category`. Clusters scoring: volume ≥ 30 + median_resolution_time ≤ 4h + cosine similarity ≥ 0.75 are flagged as automation candidates.

**New view:** **Automation Radar** sidebar item showing ranked candidate clusters with: ticket count, average handle time, suggested automation type (self-service portal, chatbot, scripted resolution, scheduled task).

#### C. Repeat Caller Intelligence

**What:** Callers who appear ≥3 times in a 30-day window across any ticket type. These are candidates for proactive outreach or a Problem ticket.

**How:** Computed server-side at batch time from SQLite history. Stored in `repeat_callers` table.

**UI:** A 🔁 badge on the caller column in results. A **Repeat Callers** card on the dashboard listing top 10 repeat callers, their categories, and a "Raise Problem Ticket" prompt.

#### D. Knowledge Base Utilisation Intelligence

**What:** Beyond "was KB used?" (Criterion 27), track *which* KB articles are referenced, detect stale/unhelpful articles (high citation + high reopen rate), and surface KB gaps (category clusters with 0% KB usage).

**How:** Extract `KB\d+` patterns from work notes and resolution notes during scoring. Store `kb_citations` table. Join with FCR failure data to surface articles that don't prevent recurrence.

**Dashboard widget:** "KB Health" card showing top cited articles, articles correlated with failed resolutions, and categories with KB gaps.

---

## 4. Technical Architecture Changes

### 4.1 Backend (server.py additions)

```
server.py
├── PyCTQEngine (existing — enhanced)
│   ├── score()                    ← adds sentiment_profile, note_suggestions,
│   │                                 category_confidence, resolution_integrity
│   ├── SentimentEngine (new)      ← 7-dimension sentiment
│   ├── NotePatternEngine (new)    ← pattern matching + suggestions
│   ├── CategoryQualityEngine (new)← TF-IDF cosine confidence
│   └── ResolutionIntegrityEngine (new) ← code-notes Jaccard
│
├── /api/history/trends            ← weekly aggregations with anomaly flags
├── /api/history/agents            ← per-agent summaries
├── /api/history/anomalies         ← flagged weeks
├── /api/patterns/notes            ← work note pattern library (CRUD)
├── /api/kb/citations              ← KB article health
├── /api/automation/candidates     ← cluster-based candidates
└── /api/analyse/sentiment         ← ad-hoc sentiment endpoint
```

### 4.2 Database schema additions

```sql
-- Extend audit_tickets
ALTER TABLE audit_tickets ADD COLUMN sentiment_profile TEXT;  -- JSON 7 dimensions
ALTER TABLE audit_tickets ADD COLUMN category_confidence REAL;
ALTER TABLE audit_tickets ADD COLUMN category_flag INTEGER DEFAULT 0;
ALTER TABLE audit_tickets ADD COLUMN category_suggestion TEXT;
ALTER TABLE audit_tickets ADD COLUMN resolution_integrity REAL;
ALTER TABLE audit_tickets ADD COLUMN fcr_fail INTEGER DEFAULT 0;
ALTER TABLE audit_tickets ADD COLUMN note_suggestions TEXT;  -- JSON array

-- New tables
CREATE TABLE note_patterns ( ... );      -- editable pattern library
CREATE TABLE kb_citations ( ... );       -- KB article references
CREATE TABLE repeat_callers ( ... );     -- 30-day window repeat callers
CREATE TABLE agent_summaries ( ... );    -- weekly per-agent rollups
CREATE TABLE anomaly_flags ( ... );      -- statistical anomaly events
CREATE TABLE automation_clusters ( ... ); -- K-means cluster results
```

### 4.3 Frontend changes

| Component | Change |
|---|---|
| `index.html` | Add new nav items: Note Patterns, Automation Radar, KB Health |
| `js/app.js` | Add 4 new view generators; replace Canvas charts with Plotly |
| `js/scoring-engine.js` | Add 7-dimension sentiment, resolution integrity, category confidence |
| `js/config-manager.js` | Add note pattern library config, category keyword map |
| `js/export-manager.js` | Add new fields to CSV/PDF export |
| `css/main.css` | Radar chart styles, anomaly badge styles, automation card styles |
| `js/history-manager.js` | **New** — fetches and renders historical data from SQLite via API |
| `js/nlp-engine.js` | **New** — client-side TF-IDF, resolution integrity, category confidence |

### 4.4 New Python dependencies

```
# requirements.txt additions
scikit-learn>=1.3    # TF-IDF, K-means for category confidence + automation clusters
numpy>=1.26          # Vector operations
```

No cloud APIs. No LLM downloads. All NLP is TF-IDF + heuristics + regex, matching the existing architecture philosophy.

---

## 5. Implementation Phasing

### Phase 1 — Foundation (prerequisite for all else)
- SQLite schema migration (new columns + new tables)
- `/api/history/*` endpoints
- Plotly.js chart replacement on Dashboard + Trends views
- Anomaly detection (rolling σ) on server side
- Interactive drill-down (filter results by clicking chart segments)

### Phase 2 — Intelligence Layer
- 7-dimension SentimentEngine
- ResolutionIntegrityEngine (code-notes mismatch)
- CategoryQualityEngine (TF-IDF confidence)
- Update PyCTQEngine.score() to return new fields
- Mirror changes in `js/scoring-engine.js`

### Phase 3 — Coaching & Patterns
- Note pattern library (SQLite table + Admin CRUD UI)
- NotePatternEngine per-ticket suggestions
- Note Patterns view (batch pattern analysis)
- KB citation extraction + KB Health dashboard widget

### Phase 4 — Automation & Repeat Intelligence
- FCR detection at batch time
- Repeat Caller intelligence + dashboard card
- Automation Radar view (K-means clustering)
- Automation candidate ranking algorithm

### Phase 5 — Polish & Export
- Agent Leaderboard view
- PDF/CSV export of new fields
- CI test coverage for new engines
- README + CHANGELOG v4.0 update

---

## 6. UX Design Principles

1. **No new complexity on the home screen.** The 4 existing KPI cards simply become 5. New views are additive sidebar items.
2. **Every score is explainable.** New scores (category confidence, resolution integrity, frustration index) always show their constituent signals when hovered.
3. **Anomalies surface themselves.** Users should not need to look for problems — the dashboard should surface "this week's score was significantly lower than your 8-week baseline" without any configuration.
4. **Suggestions are optional.** Note enhancement prompts appear in a collapsible panel — not injected into the main results table where they would add noise.
5. **Admin owns the pattern library.** The note pattern library is editable by admin users so organisations can tailor it to their terminology without code changes.
6. **Offline-first stays non-negotiable.** Plotly CDN has a fallback to bundled minified version. No feature requires a network call.

---

## 7. Design Decisions — Confirmed

All five open questions resolved (May 2026):

| # | Question | Decision |
|---|---|---|
| 1 | Category cold-start | ✅ Ship `data/category_keywords_default.json` with built-in ITIL taxonomy map |
| 2 | Note pattern library | ✅ Pre-seed with ~40 common ITSM patterns across 6 categories; admin can override |
| 3 | Automation cluster refresh | ✅ Async background Python thread; Automation Radar shows "Last updated: X" timestamp |
| 4 | History API pagination | ✅ Agent summaries paginated at 20 rows, sorted avg_score ascending (worst first) |
| 5 | Chart library | ✅ Plotly.js — zoom, pan, hover, download-as-PNG built in; core to Phase 1 value |

**Status: Implementation approved. Proceeding with Phase 1.**

---

## 8. Success Metrics for v4.0

| Metric | Target |
|---|---|
| Historical data drill-down — time to find worst agent/week | < 3 clicks |
| Sentiment accuracy (frustration detection) | Manual spot-check > 80% agreement |
| Resolution mismatch detection precision | < 20% false positives on test set |
| Category confidence flagging recall | Catch > 70% of known mis-categorised tickets |
| Note suggestion relevance | Admin rates ≥ 3/5 suggestions as "useful" per audit |
| Automation candidate precision | > 60% of flagged clusters confirmed as automation-suitable |
| Performance — 1,000-ticket batch end-to-end | < 15 seconds total (Python scoring + NLP) |

---

*This document is the authoritative design reference for v4.0. No implementation begins until the Open Questions in §7 are resolved.*
