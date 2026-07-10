# Deploying aphno.ai

- **Database** — Neon (managed Postgres), already provisioned.
- **API** — Railway, from the root `Dockerfile`.
- **Web** — Vercel, static Expo web export.
- **Mobile** — EAS build (APK/IPA).

You run the login/deploy commands yourself — these steps assume you're signed in
to each provider.

---

## 1. API → Railway

Config lives in [`railway.json`](../railway.json) (Dockerfile build + `/v1/health`
healthcheck) and the root [`Dockerfile`](../Dockerfile).

1. Create a project → **Deploy from GitHub repo** (`29shivam/aphno`). Railway
   detects `railway.json` and builds the Dockerfile.
2. Add environment variables (Service → Variables):

   | Variable           | Value                                                  |
   | ------------------ | ------------------------------------------------------ |
   | `DATABASE_URL`     | Neon **pooled** connection string                      |
   | `DIRECT_URL`       | Neon **direct** (unpooled) string — used by migrations |
   | `JWT_SECRET`       | a long random string (e.g. `openssl rand -hex 32`)     |
   | `GOOGLE_CLIENT_ID` | Google OAuth **Web** client ID — see §3                |
   | `NODE_ENV`         | `production`                                           |
   | `PORT`             | `4000`                                                 |

3. Deploy. On boot the container runs `prisma migrate deploy` then starts the API.
4. Grab the public URL (e.g. `https://aphno-api.up.railway.app`) and verify:
   `curl https://<url>/v1/health`.

> CLI alternative: `npm i -g @railway/cli && railway login && railway up`.

> At scale, move `prisma migrate deploy` from the container `CMD` to a Railway
> **pre-deploy command** so it runs once per release, not per instance.

## 2. Web → Vercel

Config lives in [`vercel.json`](../vercel.json) (builds the Expo web export to
`apps/mobile/dist`).

1. **Import Project** → the GitHub repo. Keep the root directory as the repo root
   (Vercel reads `vercel.json`).
2. Add build-time environment variables:

   | Variable                       | Value                                                         |
   | ------------------------------ | ------------------------------------------------------------- |
   | `EXPO_PUBLIC_API_URL`          | your Railway API URL, e.g. `https://aphno-api.up.railway.app` |
   | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth **Web** client ID (same as the API) — see §3     |

3. Deploy. Vercel runs `pnpm install` then the Expo web export and serves the
   static site.

> CLI alternative: `npm i -g vercel && vercel --prod`.

> **Deployment Protection:** if the deployed site redirects to a Vercel login
> (`vercel.com/sso-api`), turn off **Settings → Deployment Protection** (or scope
> it to previews only) so real users can reach the production site.

## 3. Google sign-in (OAuth)

Create an OAuth **Web application** client in the
[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
(configure the OAuth consent screen first; add yourself as a test user while it's
in Testing). Add your Vercel origin and `http://localhost:19006` to the authorized
JavaScript origins.

The **same** client ID goes in three places:

| Where         | Variable                       |
| ------------- | ------------------------------ |
| Railway (API) | `GOOGLE_CLIENT_ID`             |
| Vercel (web)  | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` |
| mobile `.env` | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` |

It must match everywhere — the API verifies the ID token's `aud` against
`GOOGLE_CLIENT_ID` (see `apps/api/src/platform/google.ts`). Native iOS/Android
builds additionally need `iosClientId`/`androidClientId` (separate credentials).

## 4. CORS

The API currently allows all origins (`origin: true`). Before going fully public,
lock CORS in `apps/api/src/app.ts` to your Vercel domain.

## 5. Mobile app (EAS)

See [`apps/mobile/README.md`](../apps/mobile/README.md). Set the app's
`EXPO_PUBLIC_API_URL` to the Railway URL, then:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview   # installable APK
```
