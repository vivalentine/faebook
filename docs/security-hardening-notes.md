# Security Hardening Notes (Cloudflare Tunnel Milestone)

## What is now enforced

- Security response headers are set for all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-site`
  - `Strict-Transport-Security` in production
- API write endpoints are rate-limited.
- Login requests are rate-limited (by IP + username).
- Authenticated mutating API calls require same-origin origin/referer validation.
- Explicit JSON and URL-encoded request body limits are configured.
- Upload endpoints enforce file size, count, and MIME/extension checks.

## CSP follow-up

`Content-Security-Policy` is intentionally not enforced in this milestone to avoid breaking
current built frontend behavior without a full asset inventory and policy tuning pass.

Follow-up recommendation:

1. inventory client script/style/font/image/connect sources from production build
2. add CSP in report-only mode first
3. migrate to an enforced CSP once violations are resolved

## New/updated server environment variables

- `HOST` (bind host)
- `TRUST_PROXY` (supports `true`, numeric hop count, or explicit proxy setting)
- `JSON_BODY_LIMIT` (default `1mb`)
- `MARKDOWN_UPLOAD_MAX_BYTES` (default `2097152`)
- `IMAGE_UPLOAD_MAX_BYTES` (default `10485760`)
- `MULTI_UPLOAD_MAX_FILES` (default `50`)
- `LOGIN_RATE_LIMIT_WINDOW_MS` (default `600000`)
- `LOGIN_RATE_LIMIT_MAX` (default `20`)
- `API_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `API_RATE_LIMIT_MAX` (default `180`)
- `HSTS_HEADER_VALUE` (production-only HSTS override)
