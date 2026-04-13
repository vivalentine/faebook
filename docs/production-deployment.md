# Production Deployment: Cloudflare Tunnel + Caddy + FaeBook

This milestone keeps the existing in-app FaeBook login model intact.

## Authentication model (unchanged)

Public users still reach the FaeBook login page and authenticate in-app with existing credentials:

- `terry / gronda`
- `usaq / qasu`
- `hilton / gilly`
- `dm / admin`

No Cloudflare Access or second login layer is introduced in this deployment shape.

## Runtime topology

Recommended production shape on the host:

1. **cloudflared** runs as a service and forwards public hostname traffic to local Caddy.
2. **Caddy** listens on localhost only and serves:
   - built frontend (`apps/client/dist`)
   - uploads (`/uploads`)
   - reverse proxy to Express for `/api/*`
3. **Express** listens on localhost only and handles API/session auth.

No router/NAT port forwarding is required when tunnel ingress targets localhost.

## Required environment files

- Server runtime file: `apps/server/.env`
- Production template: `apps/server/.env.production.example`
- Caddy runtime envs:
  - `FAEBOOK_SITE_ADDRESS` (default `127.0.0.1:8080`)
  - `FAEBOOK_BIND` (default `127.0.0.1`)
  - `FAEBOOK_API_UPSTREAM` (default `127.0.0.1:3001`)
  - `FAEBOOK_CLIENT_DIST` (default `apps/client/dist`)
  - `FAEBOOK_ROOT` (default repo root for `/uploads` path resolution)

## Build and run

From repo root:

```bash
npm install
npm install --prefix apps/client
npm install --prefix apps/server
npm run build
npm --prefix apps/server run start
```

Server production minimum values:

- `NODE_ENV=production`
- `HOST=127.0.0.1`
- `PORT=3001`
- `SESSION_SECRET=<long-random-secret>`
- `COOKIE_SECURE=1`
- `TRUST_PROXY=true`
- `CLIENT_URLS=https://<public-hostname>`

## Caddy start / reload

Example commands from repo root:

```bash
caddy validate --config Caddyfile
caddy run --config Caddyfile
# or, when using a managed service:
caddy reload --config Caddyfile
```

Caddy defaults to localhost binding in this file.

## Cache behavior and purge expectations

Current cache policy:

- `/assets/*`: immutable, long-lived cache (hashed build output)
- `/uploads/*`: short cache (`max-age=60`)
- `index.html`: `no-store`

After each deploy:

1. Build and deploy new `apps/client/dist` files.
2. Reload Caddy.
3. If users report stale app shell, purge Cloudflare cache for `index.html` (or purge all for the hostname).

Asset hashes should avoid most stale JS/CSS issues; HTML cache purge is the usual fallback.

## Optional health endpoint

A lightweight health endpoint is available:

- `GET /api/health`

It returns JSON with `ok`, service name, uptime seconds, and timestamp.

## Production readiness checklist

- [ ] Tunnel ingress points to local Caddy only (localhost address).
- [ ] No WAN/LAN port forwarding enabled for app ports.
- [ ] Server env uses `NODE_ENV=production`, `HOST=127.0.0.1`, `COOKIE_SECURE=1`.
- [ ] `SESSION_SECRET` is long/random and rotated on an intentional cadence.
- [ ] `CLIENT_URLS` contains only expected production origin(s).
- [ ] Backup destination path is writable and backup creation succeeds.
- [ ] `backups/` and `uploads/` are included in host-level backup strategy.
- [ ] Caddy config validates and reload succeeds.
- [ ] cloudflared runs as a persistent service (auto-restart on reboot/crash).
- [ ] Post-deploy cache purge plan is documented and tested.

## Notes

- This milestone intentionally preserves existing in-app sessions and role logic.
- DM/player permissions are unchanged by deployment hardening work.
