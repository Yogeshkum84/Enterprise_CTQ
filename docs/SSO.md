**SSO Integration (OIDC / SAML) — Guidance**

Overview
- For enterprise production, integrate with your Identity Provider (IdP) using OIDC (recommended) or SAML.
- OIDC (OpenID Connect) is modern, easier to test locally, and supports OAuth2 flows and JWT ID tokens.
- SAML may be required for legacy IdPs — similar integration steps apply but with XML metadata.

Configuration
- Required config (set in `.env` for server-side):
  - `OIDC_AUTH_URL` — Authorization endpoint for your IdP
  - `OIDC_TOKEN_URL` — Token endpoint
  - `OIDC_CLIENT_ID` — Client ID registered with IdP
  - `OIDC_CLIENT_SECRET` — Client secret (store in environment / vault)
  - `OIDC_REDIRECT_URI` — `https://your-host/auth/oidc/callback`

Server Changes (high level)
1. Add an endpoint `/api/auth/oidc/login` which redirects to IdP authorize URL.
2. Add `/api/auth/oidc/callback` to handle authorization code exchange; verify ID token and map claims.
3. Create or map user records server-side; establish session cookie (HTTPOnly, Secure).

Libraries
- Recommended: `authlib` (Python) or `python-jose` for token verification.

Local testing
- Use a test client in your IdP or developer sandbox. For local, you can use `ngrok` to expose a secure callback URL, or test with a mock OIDC server.

Security notes
- Use HTTPS in production (CA-signed certs). Do not expose client secrets in source control.
- Validate ID token signatures and issuers. Enforce `aud` (audience) claim matches your client id.
