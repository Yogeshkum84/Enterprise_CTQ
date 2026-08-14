# Architecture & Approach

## What the platform does

The YK CTQ Audit Intelligence Platform scores ITSM tickets (Incident, Request, Task, Change) from ServiceNow against 42 Critical-to-Quality (CTQ) criteria. Every score is a transparent, rule-based heuristic — nothing is hidden in a black-box model. A team leader or QA analyst can read a score, trace it to a specific criterion, and use it in a coaching conversation.

## Architecture

```
Browser  ──────────────────────────────────────────────────────────────
  index.html       ← App shell, login, layout
  js/app.js        ← View router, state management, CSV parser
  js/scoring-engine.js  ← 42-criterion JS engine (runs entirely in browser)
  js/ctq-worker.js ← Web Worker — keeps UI responsive during large batches
  js/config-manager.js  ← Weights, pillars, thresholds (localStorage)
  js/export-manager.js  ← CSV (42 scores) + PDF (A4 report)
  js/auth-manager.js    ← Session persistence

Flask server (server.py)  ──────────────────────────────────────────────
  GET  /           → serves index.html
  GET  /<path>     → serves static assets (js/, css/, assets/)
  POST /api/auth/login   → hashed credential check
  POST /api/audit/score  → single ticket → PyCTQEngine.score()
  POST /api/audit/batch  → 1–5,000 tickets → batch score + SQLite persist
  GET  /api/trends       → last 52 batch summaries from SQLite
  GET  /api/health       → liveness probe

SQLite  (data/ctq_history.db)  ─────────────────────────────────────────
  audit_batches   ← one row per upload (date, type, count, avg, pass_rate)
  audit_tickets   ← one row per ticket (scores, grade, pillar breakdown)
```

## The 42-Criterion CTQ framework

All 42 criteria are assigned to one of **8 Quality Pillars**:

| Pillar | Criteria |
|---|---|
| Continuous Improvement | 24, 25, 27, 28, 39 |
| Consistent Quality | 1, 4, 8, 9, 15, 16, 19 |
| Compliance | 3, 6, 14, 20, 34, 35, 38, 42 |
| Training & Coaching | 13, 31 |
| CSAT/Retention | 5, 10, 11, 12, 21, 23, 30, 32 |
| Objective Evaluation | *(reserved)* |
| Productivity | 2, 17, 22, 26, 29, 41 |
| Risk Management | 7, 18, 33, 36, 37, 40 |

Each criterion returns a score of 0–100 based on keyword patterns, field presence, and length heuristics. Weights are equal (2.38% each for criteria 1–40, 2.40% for 41–42) so no single item dominates.

### Example — Criterion 10: Additional Comments / Email Format

```
if not additional_comments → 0
if greeting (dear/hello/hi/…) AND sign-off (regards/sincerely/…) → 100
if greeting OR sign-off → 70
else → 40
```

This is immediately auditable by a QA lead and easily tunable via the Admin Panel.

### Scoring formula

```
weighted_sum = Σ(score_i × weight_i)   for i in 1..42
overall_score = min(100, weighted_sum / total_weight)
```

### Grade bands

| Band | Range |
|---|---|
| Excellent | ≥ 85 |
| Good | 70–84 |
| Fair | 50–69 |
| Poor | < 50 |

## Sentiment analysis

A simple word-count approach over `work_notes`, `additional_comments`, and `description`:

- **Positive** if positive-word hits > negative-word hits + 1
- **Negative** if negative-word hits > positive-word hits + 1
- **Neutral** otherwise

Word lists are configurable in `js/config-manager.js` (browser) and `PyCTQEngine.SENTIMENT_POS / SENTIMENT_NEG` (server).

## Dual engine design (JS + Python)

The scoring logic exists in two places that must remain in sync:

| Location | When used |
|---|---|
| `js/scoring-engine.js` | Real-time browser scoring — processes the CSV client-side, no round-trip |
| `server.py → PyCTQEngine` | Server-side batch scoring + persistence; also callable from other Python tools |

This means the app works fully offline (all scoring in the browser) but also exposes a REST API for integration with other tooling or scripted pipelines.

## Persistence strategy

The SQLite store is **append-only** — each upload creates a new batch record. This means:

1. You can re-upload corrected data without losing prior history.
2. Week-over-week trend charts are always based on all persisted batches.
3. There is no data migration complexity for a local-first single-user tool.

## Operating cadence

```
Initial load  → upload 12 months of historical data in one batch
Weekly cadence → export current week from ServiceNow → drop into New Audit
Dashboard     → reflects full accumulation automatically
```
