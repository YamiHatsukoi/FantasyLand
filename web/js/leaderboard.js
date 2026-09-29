// Leaderboard: Supabase REST (PostgREST) nếu đã cấu hình, ngược lại dùng localStorage.
window.Leaderboard = (() => {
  "use strict";
  const cfg = window.FL_CONFIG || {};
  const url = (cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = cfg.SUPABASE_ANON_KEY || "";
  const online = Boolean(url && key);
  const LOCAL_KEY = "fantasyland.scores";

  function headers(extra) {
    const h = { apikey: key, "Content-Type": "application/json", ...extra };
    // Legacy anon keys are JWTs and also go in Authorization; new publishable keys don't.
    if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
    return h;
  }

  function cleanName(name) {
    return String(name || "").replace(/\s+/g, " ").trim().slice(0, 16);
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
  }

  function writeLocal(rows) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); } catch { /* storage unavailable */ }
  }

  function localTop(limit) {
    return readLocal().sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async function top(limit = 10) {
    if (!online) return localTop(limit);
    const q = `select=name,score,wave,created_at&order=score.desc,created_at.asc&limit=${limit}`;
    const res = await fetch(`${url}/rest/v1/scores?${q}`, { headers: headers() });
    if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`);
    return res.json();
  }

  async function submit(name, score, wave) {
    const row = { name: cleanName(name), score: Math.floor(score), wave: Math.floor(wave) };
    if (!row.name) throw new Error("Tên không hợp lệ");
    if (!online) {
      const rows = readLocal();
      rows.push({ ...row, created_at: new Date().toISOString() });
      writeLocal(rows.sort((a, b) => b.score - a.score).slice(0, 50));
      return row;
    }
    const res = await fetch(`${url}/rest/v1/scores`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`);
    return row;
  }

  return { online, top, submit, cleanName };
})();
