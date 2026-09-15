# Friday Pilot

A shared tracker for the aquatic OT validation plan — roadmap, pool log,
demand log, referral network, financial model, and a notes thread between
Judy and Emelia. Plain HTML/CSS/JS plus one small serverless function —
no build step, no framework, nothing to `npm install`.

## What's in this folder

- `index.html` — the whole app (this is the only page)
- `api/state.js` — a tiny serverless function that reads/writes the shared data
- `package.json` — just metadata, no dependencies

## Deploy it (no coding tools needed)

**1. Put the code on GitHub**
1. Go to [github.com/new](https://github.com/new), create a repository (e.g. `friday-pilot`), keep it **Private**.
2. On the new repo's page, click **"uploading an existing file"**.
3. Drag in `index.html`, the `api` folder, `package.json`, and `.gitignore` from this folder, then **Commit changes**.

**2. Deploy it on Vercel**
1. Go to [vercel.com/new](https://vercel.com/new) and sign in (you can use your GitHub account to sign in — free).
2. Choose **Import** next to the `friday-pilot` repo you just created.
3. Leave all settings as-is (Vercel auto-detects this as a static site + functions) and click **Deploy**.
4. In a minute you'll get a link like `friday-pilot-yourname.vercel.app` — that's the app, right now it'll say "storage isn't connected yet" in an amber banner. That's expected — next step fixes it.

**3. Turn on shared storage** (this is what makes Judy's and Emelia's changes sync)
1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database**, choose the Redis / KV option (Upstash), and connect it to this project.
3. Vercel will automatically add the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables for you.
4. Go to **Deployments**, open the latest one, and click **Redeploy** (so the app picks up the new environment variables).
5. Reload the site — the amber banner should be gone and the sidebar should say "Live — shared with Judy & Emelia".

**4. (Optional) Add a shared password**
Since this link won't be behind a Claude/Google sign-in, anyone who has the
URL could open it. If you'd rather it not be wide open:
1. In Vercel, go to **Settings → Environment Variables**.
2. Add one named `APP_PASSWORD` with whatever password you want to share with Emelia.
3. Redeploy. The app will now ask for that password on first visit (each browser remembers it after that).

If you skip this step the app just stays open to anyone with the link — fine for a low-stakes internal tool, but worth knowing.

**5. Send Emelia the link**
Once storage is connected, share the `vercel.app` link (and the password, if you set one). Whatever either of you edits — checklists, notes, log entries, financial numbers — the other person sees on their next refresh (it also checks for updates automatically every few seconds while the tab is open).

## If you'd rather use the command line

If you have Node.js installed, you can skip GitHub entirely:

```bash
npx vercel
```

Run that from inside this folder, follow the prompts to log in and create
the project, then do steps 3 and 4 above from the Vercel dashboard, and
`npx vercel --prod` to redeploy after adding storage.

## Notes on how it works

- All shared data lives in one small Redis-compatible store (whatever you
  connect in the Storage tab), as a handful of JSON blobs — one for the
  roadmap, one for the pool log, one for financial inputs, etc.
- The frontend polls for updates every 5 seconds while the tab is open and
  visible, and immediately re-checks when you switch back to the tab —
  it's not instant push-based sync, but it's close enough for two people
  passing notes and checking boxes.
- If the storage integration is ever removed or misconfigured, the app
  falls back to saving in that browser's local storage only, and shows a
  banner saying so, rather than breaking.
