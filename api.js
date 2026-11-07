// Связь с сервером (Apps Script). Без QUIZ_API_URL — демо-режим в localStorage.
(function () {
  const URL_ = (window.QUIZ_API_URL || '').trim();
  const DEMO = !URL_;

  async function real(payload) {
    const res = await fetch(URL_, {
      method: 'POST',
      // text/plain — чтобы браузер не делал preflight-запрос (Apps Script его не поддерживает)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) { const e = new Error(data.error || 'server_error'); e.server = true; throw e; }
    return data;
  }

  // ---------- демо-сервер ----------
  const DB_KEY = 'quiz_demo_db';
  const ADMIN_KEY_DEMO = 'demo';
  function db() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || { people: {}, answers: {} }; } catch (e) { return { people: {}, answers: {} }; } }
  function save(d) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
  async function demo(p) {
    await new Promise(r => setTimeout(r, 150));
    const d = db(); const now = new Date().toISOString();
    const fail = (e) => { const x = new Error(e); x.server = true; throw x; };
    switch (p.action) {
      case 'register':
        d.people[p.id] = Object.assign(d.people[p.id] || { started: now, finished: '', bonus: 0 }, { id: p.id, name: p.name });
        save(d); return { ok: true, id: p.id };
      case 'answer': {
        if (!d.people[p.id]) d.people[p.id] = { id: p.id, name: p.name, started: now, finished: '', bonus: 0 };
        const k = p.id + '|' + p.q; const old = d.answers[k];
        d.answers[k] = { id: p.id, q: +p.q, question: p.question, value: p.value, auto: p.value ? 1 : 0, bonus: old ? old.bonus : 0, at: now };
        save(d); return { ok: true };
      }
      case 'finish':
        if (d.people[p.id] && !d.people[p.id].finished) d.people[p.id].finished = now;
        save(d); return { ok: true };
      case 'admin_bonus':
        if (p.key !== ADMIN_KEY_DEMO) fail('wrong_key');
        if (+p.q > 0) { const a = d.answers[p.id + '|' + p.q]; if (!a) fail('answer_not_found'); a.bonus += +p.delta; }
        else { if (!d.people[p.id]) fail('participant_not_found'); d.people[p.id].bonus += +p.delta; }
        save(d); // fallthrough to list
      case 'admin_list': {
        if (p.key !== ADMIN_KEY_DEMO) fail('wrong_key');
        const map = {};
        const list = Object.values(d.people).map(x => (map[x.id] = Object.assign({}, x, { answers: {}, score: x.bonus })));
        Object.values(d.answers).forEach(a => { const x = map[a.id]; if (!x) return; x.answers[a.q] = a; x.score += a.auto + a.bonus; });
        return { ok: true, participants: list, serverTime: now };
      }
    }
    fail('unknown_action');
  }

  window.QuizAPI = { DEMO, call: (payload) => (DEMO ? demo(payload) : real(payload)) };
})();
