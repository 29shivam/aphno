# Deploying APHNO

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

   | Variable       | Value                                                  |
   | -------------- | ------------------------------------------------------ |
   | `DATABASE_URL` | Neon **pooled** connection string                      |
   | `DIRECT_URL`   | Neon **direct** (unpooled) string — used by migrations |
   | `JWT_SECRET`   | a long random string (e.g. `openssl rand -hex 32`)     |
   | `NODE_ENV`     | `production`                                           |
   | `PORT`         | `4000`                                                 |

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
2. Add a build-time environment variable:

   | Variable              | Value                                                         |
   | --------------------- | ------------------------------------------------------------- |
   | `EXPO_PUBLIC_API_URL` | your Railway API URL, e.g. `https://aphno-api.up.railway.app` |

3. Deploy. Vercel runs `pnpm install` then the Expo web export and serves the
   static site.

> CLI alternative: `npm i -g vercel && vercel --prod`.

## 3. CORS

The API currently allows all origins (`origin: true`). Before going fully public,
lock CORS in `apps/api/src/app.ts` to your Vercel domain.

## 4. Mobile app (EAS)

See [`apps/mobile/README.md`](../apps/mobile/README.md). Set the app's
`EXPO_PUBLIC_API_URL` to the Railway URL, then:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview   # installable APK
```
