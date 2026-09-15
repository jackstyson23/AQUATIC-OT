// Shared state store for Friday Pilot.
//
// One JSON blob per "section" (weeks, pool, demand, referrals, notes,
// financial, growth, exitThreshold, brainstorm), stored in Redis. Works with
// Vercel's "Redis" storage integration (Storage tab -> Create Database ->
// Redis): once you connect that database to this project, it sets a
// REDIS_URL environment variable and this file picks it up on the next
// deploy. Needs the "redis" package from package.json (Vercel installs it
// automatically at deploy time).
//
// GET  /api/state                 -> { state: { <section>: <value>, ... } }
// GET  /api/state?section=pool    -> { value: <value> }
// POST /api/state  {section, value} -> { ok: true }
//
// Optional shared-password protection: set an APP_PASSWORD environment
// variable in the Vercel dashboard and every request must carry a matching
// "x-app-password" header, or it gets a 401.

const { createClient } = require("redis");

const SECTIONS = [
  "weeks", "pool", "demand", "referrals", "notes",
  "financial", "growth", "exitThreshold", "brainstorm"
];
const KEY_PREFIX = "fridaypilot:";

// Reuse one connection across warm invocations of the same function instance.
let clientPromise = null;
function getClient() {
  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => {}); // swallow background errors so they don't crash the process
    clientPromise = client.connect().then(
      () => client,
      (err) => { clientPromise = null; throw err; }
    );
  }
  return clientPromise;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.REDIS_URL) {
    res.status(503).json({
      error: "storage_not_configured",
      message: "Add a Redis storage integration in the Vercel dashboard (Storage tab -> Create Database -> Redis), connect it to this project, then redeploy."
    });
    return;
  }

  const requiredPassword = process.env.APP_PASSWORD;
  if (requiredPassword) {
    const given = req.headers["x-app-password"];
    if (given !== requiredPassword) {
      res.status(401).json({ error: "bad_password" });
      return;
    }
  }

  try {
    const client = await getClient();

    if (req.method === "GET") {
      const section = req.query && req.query.section;

      if (section) {
        if (SECTIONS.indexOf(section) === -1) {
          res.status(400).json({ error: "invalid_section" });
          return;
        }
        const raw = await client.get(KEY_PREFIX + section);
        let value = null;
        try { value = raw ? JSON.parse(raw) : null; } catch (e) { value = null; }
        res.status(200).json({ value });
        return;
      }

      const raws = await client.mGet(SECTIONS.map((s) => KEY_PREFIX + s));
      const state = {};
      SECTIONS.forEach((s, i) => {
        try { state[s] = raws[i] ? JSON.parse(raws[i]) : null; }
        catch (e) { state[s] = null; }
      });
      res.status(200).json({ state });
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
      const section = body.section;
      if (SECTIONS.indexOf(section) === -1) {
        res.status(400).json({ error: "invalid_section" });
        return;
      }
      const value = body.value === undefined ? null : body.value;
      await client.set(KEY_PREFIX + section, JSON.stringify(value));
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    res.status(502).json({ error: "storage_error", message: String((err && err.message) || err) });
  }
};
