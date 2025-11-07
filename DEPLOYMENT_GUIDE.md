# Kartess Production Readiness & Deployment Guide

This document captures the latest production audit and the exact steps to deploy Kartess to **Vercel** (frontend) and **Railway** (backend). Keep it alongside the repository for future launches or rollbacks.

---

## 1. Production Readiness Audit

| Area | Status | Details / Actions |
| ---- | ------ | ----------------- |
| **Architecture & Build** | ✅ Ready | Next.js 16 frontend and Express/Prisma backend both build cleanly (`npm run build`). Socket.io and background workers tested. |
| **Environment Validation** | ✅ Ready | `backend/middleware/envValidation.js` enforces required vars (`JWT_SECRET`, `DATABASE_URL`, `NODE_ENV`). Optional warnings for Cloudinary, Agora, VAPID, etc. |
| **Auth & Security** | ✅ Ready | JWT Access+Refresh with hashed storage, per-request rate limiting, Helmet/CORS, Sentry. Message encryption defaults to plaintext for cross-device compatibility (documented trade-off). |
| **Logging & Monitoring** | ✅ Ready | Winston structured logging with file + console transports. `/health` exposes version, DB latency, uptime. Sentry hooks enabled when DSN present. |
| **Background Jobs** | ✅ Ready | `/api/background/cleanup-refresh-tokens` cleans expired refresh tokens. Account deletion removes refresh tokens cascade. |
| **Realtime Features** | ✅ Ready | Messaging, typing, reactions, notifications, reels filtering validated after recent fixes. Socket events handled across feeds (`post.new`, `post.deleted`). |
| **Data Integrity** | ✅ Ready | Prisma schema cascades for posts/comments/reactions. Refresh token rotation pending (documented as future enhancement). |
| **Testing** | ⚠️ Run Before Deploy | Jest configured for both projects; last manual run not captured. Execute `npm run test` in `backend/` and `frontend/` before pushing. |
| **Accessibility** | ✅ Ready | `eslint-plugin-jsx-a11y` enforced; modal/toast/button components updated with ARIA roles. Manual Lighthouse audit recommended per release. |
| **Docs & DX** | ✅ Ready | README documents env vars, APIs, features. Deployment guide (this file) created. |
| **Open Follow-ups** | ℹ️ Track | Optional features: refresh token rotation, CAPTCHA enablement, advanced load testing + APM integration. Not blockers for MVP launch. |

**Pre-deploy checklist**

1. Confirm all tests pass:  
   ```bash
   cd backend && npm install && npm run test
   cd ../frontend && npm install && npm run test
   ```
2. Provision production secrets:
   - `DATABASE_URL` (Neon / Railway Postgres)
   - `JWT_SECRET` (32+ chars)
   - `CLOUDINARY_URL`
   - `AGORA_*` (if calls enabled)
   - VAPID keys (for push)
   - `NEXT_PUBLIC_API_URL` (frontend to backend base URL)
3. Capture Sentry DSNs, optional Vercel analytics tokens.
4. Prepare Prisma migrations (`npx prisma migrate deploy`) post-deploy.

---

## 2. Deployment Overview

**Repo layout**
```
frontend/   -> Next.js app (deployed to Vercel)
backend/    -> Express/Prisma API (deployed to Railway)
node        -> Package-locks per project (leave checked in)
```

Deploy the backend first so the API URL is available for the frontend environment.

---

## 3. Backend Deployment (Railway)

### Prerequisites
- Railway account with access to project.
- PostgreSQL database URL (Railway Postgres or external Neon).
- Cloudinary, Agora, VAPID keys ready (optional features).

### Steps
1. **Create Railway project**
   - `New Project` → `Deploy from GitHub`.
   - Select the Kartess repo and grant access.

2. **Configure service**
   - When prompted for root directory, set it to `backend`.
   - Build command: `npm install`.
   - Start command: `npm run start`.
   - Railway auto-detects Node.js runtime; ensure environment is set to `production`.

3. **Set environment variables** (`Variables` tab)
   ```
   NODE_ENV=production
   DATABASE_URL=...
   JWT_SECRET=...
   FRONTEND_URL=https://<vercel-domain>
   CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud-name>  # optional but required for media
   AGORA_APP_ID=...                      # optional
   AGORA_APP_CERTIFICATE=...             # optional
   SENTRY_DSN=...                        # optional
   VAPID_PUBLIC_KEY=...                  # optional
   VAPID_PRIVATE_KEY=...                 # optional
   VAPID_EMAIL=mailto:admin@example.com  # optional
   ```

4. **Install dependencies & build**
   - Railway runs `npm install` automatically on deployment.
   - Check logs to confirm no install errors.

5. **Run Prisma migrations**
   - Open Railway shell (`Actions → Launch Shell`).
   - Run:
     ```bash
     npx prisma migrate deploy
     ```
   - Verify `Database is up to date` message.

6. **Enable HTTP/Socket ports**
   - Default service port is `3001`. Railway maps to a public URL (copy it for frontend `NEXT_PUBLIC_API_URL`).

7. **Test API**
   - Hit `https://<railway-domain>/health` → should return status `ok`.
   - Validate auth endpoints using Postman or curl (`/api/auth/login`, `/api/users/account`, etc.).

8. **Set up logs & alerts**
   - In Railway, enable log retention.
   - Optionally pipe logs to external (Datadog, Logtail) via Winston transports.

---

## 4. Frontend Deployment (Vercel)

### Prerequisites
- Vercel account.
- Railway backend URL ready (HTTPS).
- All public environment variables collected.

### Steps
1. **Create Vercel project**
   - `Add New → Project` → import the Kartess GitHub repo.
   - Project settings:
     - Framework: Next.js
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Install Command: `npm install`
     - Output Directory: `.next`

2. **Environment variables** (`Settings → Environment Variables`)
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://<railway-backend-url>
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...                # if push enabled
   NEXT_PUBLIC_SENTRY_DSN=...                      # optional
   NEXT_PUBLIC_SOCKET_URL=https://<railway-backend-url>  # if using explicit socket endpoint
   CLOUDINARY_URL=...                              # for ISR builds needing upload
   ```
   - Vercel automatically injects `VERCEL_URL`. If using custom domain, set `FRONTEND_URL` in Railway to match.

3. **Link Sentry (optional)**
   - If monitoring with Sentry, run `npx @sentry/wizard -i nextjs` locally for DSN config (already present). Provide `SENTRY_AUTH_TOKEN` in Vercel when enabling source map uploads.

4. **Deploy**
   - Vercel will install dependencies, run `npm run build`, and host the static + server-side assets.
   - Ensure build outputs `Next.js build complete` without warnings.

5. **Post-deploy validation**
   - Visit `https://<vercel-domain>` → confirm login, feed, reels, threads work.
   - Check network requests point to Railway backend (CORS must allow front domain).

6. **Optional: Custom domain**
   - Add your domain in Vercel → update DNS (`A`/`CNAME`) per instructions.
   - Update `FRONTEND_URL` env var in Railway to new domain for accurate CORS and email links.

---

## 5. Integration Checklist

- [ ] Backend `/health` returns `ok`.
- [ ] `POST /api/auth/login` works with live credentials.
- [ ] Reels appear only on `/reels` and visuals reels tab.
- [ ] Threads posts tagged with `threads` appear under `/[username]/threads`.
- [ ] Account deletion and post deletion work; verify in DB.
- [ ] Push notifications (if enabled) confirm subscription success.
- [ ] Voice/video call flow retrieves Agora credentials (only if `AGORA_*` set).
- [ ] Webhooks or background endpoints secured with existing secrets (`verifyWebhook` middleware).

---

## 6. Operational Runbook (Post Launch)

1. **Monitoring**
   - Vercel Insights & Sentry monitor frontend errors.
   - Railway logs + Winston files capture backend incidents (`backend/logs/` for persistent storage if mounted).
2. **Database backups**
   - Neon/Railway provide PITR. Verify schedule and retention.
3. **Token cleanup**
   - Schedule a cron (Railway or external) to call `POST /api/background/cleanup-refresh-tokens` daily.
4. **Scaling**
   - Railway can be scaled vertically; consider horizontal scaling with Redis for Socket.io if load increases.
5. **Security maintenance**
   - Rotate `JWT_SECRET` and VAPID keys occasionally (invalidate refresh tokens after rotation).
   - Enable CAPTCHA (`CAPTCHA_PROVIDER`, `RECAPTCHA_SECRET`) if abuse increases.

---

## 7. Quick Reference Commands

```bash
# Backend
cd backend
npm install
npm run build            # if you add a build step later
npm run test
npx prisma migrate deploy

# Frontend
cd frontend
npm install
npm run lint
npm run test
npm run build
```

Deploy with confidence. If issues arise, consult Vercel/Railway deployment logs and the Winston logs emitted in your services. For further hardening (refresh token rotation, load tests, WAF), track them as follow-up tickets after launch. Good luck with Kartess! 🚀


