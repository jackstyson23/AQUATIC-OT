// Shared state store for Friday Pilot.
//
// One JSON blob per "section" (weeks, pool, demand, referrals, notes,
// financial, growth, exitThreshold, brainstorm), stored in a Redis-compatible
// key-value store via its REST API. Works with Vercel's "KV" / "Upstash for
// Redis" storage integration out of the box: once you add that integration
// to your Vercel project (Storage tab -> Create Database), it sets the
// KV_REST_API_URL and KV_REST_API_TOKEN environment variables automatically
// and this file picks them up on the next deploy. No npm dependency needed —
// this only uses the fetch that's already built into the Node runtime.
//
// GET  /api/state                 -> { state: { <section>: <value>, ... } }
// GET  /api/state?section=pool    -> { value: <value> }
// POST /api/state  {section, value} -> { ok: true }
//
// Optional shared-password protection: set an APP_PASSWORD environment
// variable in the Vercel dashboard and every request must carry a matching
// "x-app-password" header, or it gets a 401.

const SECTIONS = [
  "weeks", "pool", "demand", "referrals", "notes",
  "financial", "growth", "exitThreshold", "brainstorm"
];
const KEY_PREFIX = "fridaypilot:";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) {
    res.status(503).json({
      error: "storage_not_configured",
      message: "Add a KV / Upstash Redis storage integration in the Vercel dashboard (Storage tab -> Create Database), then redeploy."
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

  async function kv(command) {
    const r = await fetch(KV_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(command)
    });
    if (!r.ok) throw new Error("kv_http_" + r.status);
    const data = await r.json();
    return data.result;
  }

  async function kvPipeline(commands) {
    const r = await fetch(KV_URL + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error("kv_http_" + r.status);
    const data = await r.json();
    return data.map((entry) => entry.result);
  }

  try {
    if (req.method === "GET") {
      const section = req.query && req.query.section;

      if (section) {
        if (SECTIONS.indexOf(section) === -1) {
          res.status(400).json({ error: "invalid_section" });
          return;
        }
        const raw = await kv(["GET", KEY_PREFIX + section]);
        let value = null;
        try { value = raw ? JSON.parse(raw) : null; } catch (e) { value = null; }
        res.status(200).json({ value });
        return;
      }

      const results = await kvPipeline(SECTIONS.map((s) => ["GET", KEY_PREFIX + s]));
      const state = {};
      SECTIONS.forEach((s, i) => {
        try { state[s] = results[i] ? JSON.parse(results[i]) : null; }
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
      await kv(["SET", KEY_PREFIX + section, JSON.stringify(value)]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    res.status(502).json({ error: "storage_error", message: String((err && err.message) || err) });
  }
};
