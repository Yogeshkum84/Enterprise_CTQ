# Security Policy

## Scope

The CTQ Audit Platform runs entirely locally — **no ticket data is transmitted off your machine**. Security concerns worth reporting include:

- Path-traversal in the static file server
- Credential exposure in API responses
- XSS in dashboard rendering of ticket text

## Reporting a vulnerability

Please open a **private** security advisory on GitHub rather than a public issue. We will respond within 14 days.

## Hardening for shared environments

If you deploy this on a shared server (not just a personal laptop), take these steps before opening to colleagues:

1. Replace the plain `USERS` dict in `server.py` with a proper hashed credential store (e.g. using `bcrypt`).
2. Run behind a reverse proxy (nginx / Caddy) with HTTPS.
3. Set `debug=False` in `app.run()` (already the default in the released code).
4. Ensure `data/ctq_history.db` is not web-accessible (it isn't by default, but double-check if you change the static file routing).
