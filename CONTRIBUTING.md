# Contributing

Thank you for your interest in improving the YK CTQ Audit Intelligence Platform.

## Getting started

```bash
git clone https://github.com/Yogeshkum84/ctq-enterprise.git
cd ctq-enterprise
python -m venv .venv && .venv\Scripts\activate   # Windows
# or: source .venv/bin/activate                  # macOS / Linux
pip install -r requirements.txt
python server.py
```

Open http://localhost:8745 and confirm the login screen appears.

## What we'd love help with

- Additional CTQ heuristics or improvements to existing criterion logic in `js/scoring-engine.js` and `server.py` (`PyCTQEngine`)
- A Power BI template (`.pbit`) bound to `data/ctq_history.db`
- Automated tests for the Python scoring engine
- Docker packaging
- Accessibility improvements to the frontend

## Submitting changes

1. Fork and create a feature branch from `main`.
2. Keep frontend changes in the relevant JS/CSS files — don't inline styles or scripts into `index.html`.
3. If you touch scoring logic, make sure the Python engine (`PyCTQEngine` in `server.py`) and the JS engine (`ScoringEngine` in `js/scoring-engine.js`) stay in sync — they must return identical results for the same input.
4. Open a PR with a short description of the change and why.

## Bug reports

Open an issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Browser and Python version
- **Anonymised** ticket data only — never include real PII or ticket content

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
