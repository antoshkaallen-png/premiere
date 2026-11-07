// 🎛️ ANTOSHKAALLEN TV / УПРАВЛЕНИЕ ЭФИРОМ — раздел существующей админки (тот же ключ и сервер).
window.AdminTV = (function () {
  const MSK = 'Europe/Moscow';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const tFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, hour: '2-digit', minute: '2-digit' });
  const dFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, day: '2-digit', month: 'long', year: 'numeric' });

  let ctx = null, root = null, tv = null, offset = 0, pollT = null, tickT = null, busy = false;
  const now = () => Date.now() + offset;

  function css() {
    if (document.getElementById('tv-css')) return;
    const s = document.createElement('style'); s.id = 'tv-css';
    s.textContent = `
      #tv-root { display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:12px; }
      #tv-root .blk { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }
      #tv-root h3 { margin:0 0 12px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--dim); }
      #tv-root .big { font-family:var(--serif); font-size:44px; line-height:1; font-weight:600; font-variant-numeric:tabular-nums; }
      #tv-root .grid { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
      #tv-root .grid .btn { flex:1 1 auto; min-width:90px; }
      #tv-root .btn.on { background:var(--green); color:#000; }
      #tv-root .btn.warn { background:var(--red); color:#fff; }
      #tv-root label { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:8px 0; font-size:14px; }
      #tv-root input[type=number], #tv-root input[type=text] { width:90px; background:transparent; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:7px 9px; }
      #tv-root input[type=text] { width:100%; }
      #tv-root .badge { display:inline-block; font-size:11px; letter-spacing:.12em; padding:3px 8px; border-radius:99px; border:1px solid var(--line); margin-left:6px; vertical-align:middle; }
      #tv-root .badge.red { background:var(--red); border-color:var(--red); color:#fff; }
      #tv-root a { color:var(--gold); word-break:break-all; }
      #tv-root canvas { width:160px; height:160px; background:#fff; border-radius:8px; display:block; margin:10px 0; }
    `;
    document.head.appendChild(s);
  }

  function mount(body, c) {
    ctx = c;
    if (body.querySelector('#tv-root')) return;      // уже открыт — не перерисовываем (автообновление админки)
    css();
    const base = new URL('./', location.href).href;
    body.innerHTML = `
      <div id="tv-root">
        <div class="blk">
          <h3>⏱ Таймер</h3>
          <div class="muted">Начало шоу (МСК): <b id="tv-start" style="color:var(--ink)">—</b> <span id="tv-state"></span></div>
          <div class="muted" style="margin-top:10px">Осталось</div>
          <div class="big" id="tv-left">--:--:--</div>
          <div class="grid">
            <button class="btn ghost" data-op="shift" data-m="-5">−5 МИН</button>
            <button class="btn ghost" data-op="shift" data-m="-1">−1 МИН</button>
            <button class="btn ghost" data-op="shift" data-m="1">+1 МИН</button>
            <button class="btn ghost" data-op="shift" data-m="5">+5 МИН</button>
          </div>
          <div class="grid">
            <button class="btn" data-op="pause">ПАУЗА</button>
            <button class="btn" data-op="resume">ПРОДОЛЖИТЬ</button>
            <button class="btn ghost" data-op="reset" data-confirm="Сбросить таймер к 19:55 3 декабря?">СБРОСИТЬ К 19:55</button>
          </div>
        </div>

        <div class="blk">
          <h3>🃏 Карточки гостей</h3>
          <div class="grid">
            <button class="btn" id="tv-auto">АВТОПОКАЗ</button>
            <button class="btn" data-op="next">ПОКАЗАТЬ СЛЕДУЮЩУЮ</button>
            <button class="btn ghost" data-op="hide">СКРЫТЬ ТЕКУЩУЮ</button>
            <button class="btn ghost" id="tv-timeronly">ТОЛЬКО ТАЙМЕР</button>
          </div>
          <label>Интервал между карточками, сек <input type="number" id="tv-interval" min="10" max="600"></label>
          <label>Показ одной карточки, сек <input type="number" id="tv-duration" min="3" max="30"></label>
          <label>Приоритет новых гостей <input type="checkbox" id="tv-prionew"></label>
          <label>Повторный показ карточек <input type="checkbox" id="tv-repeat"></label>
          <button class="btn red" id="tv-save" style="width:100%;margin-top:6px">Сохранить настройки</button>
        </div>

        <div class="blk">
          <h3>📺 Эфир</h3>
          <div class="muted">Сейчас на экране: <b id="tv-mode" style="color:var(--ink)">—</b></div>
          <div class="grid">
            <button class="btn warn" data-op="mode" data-mode="final">ЗАПУСТИТЬ ФИНАЛЬНЫЙ ОТСЧЁТ</button>
            <button class="btn warn" data-op="mode" data-mode="opening" data-confirm="Запустить открытие на большом экране?">ЗАПУСТИТЬ ОТКРЫТИЕ</button>
            <button class="btn" data-op="mode" data-mode="main">ВЕРНУТЬ ОСНОВНОЙ ЭКРАН</button>
          </div>
          <p class="muted" style="margin-top:12px">За 2 минуты до начала экран сам переходит в финальный отсчёт. Если добавить время, он вернётся в обычный режим.</p>
        </div>

        <div class="blk">
          <h3>🔗 Ссылки и QR</h3>
          <div class="muted">Большой экран:</div>
          <a id="tv-link" href="${esc(base)}tv.html" target="_blank">${esc(base)}tv.html</a>
          <div class="muted" style="margin-top:10px">Квиз (куда ведёт QR):</div>
          <input type="text" id="tv-quizurl" placeholder="${esc(base)}">
          <canvas id="tv-qr" width="320" height="320"></canvas>
          <div class="grid"><button class="btn" id="tv-qrpng">⬇ Скачать QR (PNG)</button><button class="btn ghost" id="tv-urlsave">Сохранить ссылку</button></div>
        </div>
      </div>`;
    root = body.querySelector('#tv-root');

    root.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
      if (b.dataset.confirm && !confirmBox(b, b.dataset.confirm)) return;
      const p = { op: b.dataset.op };
      if (b.dataset.m) p.minutes = +b.dataset.m;
      if (b.dataset.mode) p.mode = b.dataset.mode;
      control(p, b);
    });
    root.querySelector('#tv-auto').onclick = (e) => control({ op: 'settings', set: { autoplay: !(tv && tv.autoplay) } }, e.target);
    root.querySelector('#tv-timeronly').onclick = (e) => control({ op: 'mode', mode: tv && tv.mode === 'timer_only' ? 'main' : 'timer_only' }, e.target);
    root.querySelector('#tv-save').onclick = (e) => control({ op: 'settings', set: {
      interval: +root.querySelector('#tv-interval').value, duration: +root.querySelector('#tv-duration').value,
      priorityNew: root.querySelector('#tv-prionew').checked, allowRepeat: root.querySelector('#tv-repeat').checked } }, e.target);
    root.querySelector('#tv-urlsave').onclick = (e) => control({ op: 'settings', set: { quizUrl: root.querySelector('#tv-quizurl').value.trim() } }, e.target);
    root.querySelector('#tv-qrpng').onclick = downloadQR;

    loadQRLib();
    poll(true);
    clearInterval(tickT); tickT = setInterval(tick, 250);
  }

  // подтверждение без window.confirm: второй клик в течение 4 секунд
  function confirmBox(btn, text) {
    if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; return true; }
    btn.dataset.label = btn.textContent; btn.dataset.armed = '1'; btn.textContent = 'Точно? Нажмите ещё раз';
    setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; } }, 4000);
    return false;
  }

  function alive() { return root && document.body.contains(root); }

  async function poll(first) {
    clearTimeout(pollT);
    if (!alive()) return stop();
    const t0 = Date.now();
    try {
      const r = await ctx.API.call({ action: 'tv_state', feed: false });
      offset = r.now - (t0 + Date.now()) / 2;
      apply(r.tv, first);
    } catch (e) { /* повторим */ }
    pollT = setTimeout(() => poll(false), 5000);
  }

  async function control(p, btn) {
    if (busy) return; busy = true;
    if (btn) btn.disabled = true;
    try {
      const t0 = Date.now();
      const r = await ctx.API.call(Object.assign({ action: 'tv_control', key: ctx.key }, p));
      offset = r.now - (t0 + Date.now()) / 2;
      apply(r.tv, p.op === 'settings');
      toast('Отправлено на экран ✓');
    } catch (e) {
      toast(e.message === 'wrong_key' ? 'Неверный ключ' : e.message === 'bad_url' ? 'Ссылка должна начинаться с https://' : 'Ошибка: ' + e.message);
    } finally { busy = false; if (btn) btn.disabled = false; }
  }

  function apply(s, refillForm) {
    tv = s; if (!alive()) return;
    const q = (sel) => root.querySelector(sel);
    q('#tv-start').textContent = tFmt.format(s.startAt) + ', ' + dFmt.format(s.startAt);
    q('#tv-state').innerHTML = s.paused ? '<span class="badge red">ПАУЗА</span>' : '';
    const auto = q('#tv-auto'); auto.textContent = 'АВТОПОКАЗ: ' + (s.autoplay ? 'ВКЛ' : 'ВЫКЛ'); auto.classList.toggle('on', s.autoplay);
    const to = q('#tv-timeronly'); to.classList.toggle('on', s.mode === 'timer_only');
    if (refillForm || !q('#tv-interval').value) {
      q('#tv-interval').value = s.interval; q('#tv-duration').value = s.duration;
      q('#tv-prionew').checked = !!s.priorityNew; q('#tv-repeat').checked = !!s.allowRepeat;
      q('#tv-quizurl').value = s.quizUrl || '';
    }
    drawQR();
    tick();
  }

  function tick() {
    if (!alive()) return stop();
    if (!tv) return;
    const rem = tv.paused ? tv.pausedLeft : tv.startAt - now();
    const t = Math.max(0, Math.ceil(rem / 1000));
    const d = Math.floor(t / 86400);
    root.querySelector('#tv-left').textContent = (d ? d + ' дн ' : '') + p2(Math.floor(t % 86400 / 3600)) + ':' + p2(Math.floor(t % 3600 / 60)) + ':' + p2(t % 60);
    const names = { main: 'основной экран', timer_only: 'только таймер', final: 'финальный отсчёт (вручную)', opening: 'открытие' };
    let m = names[tv.mode] || tv.mode;
    if (tv.mode !== 'opening' && rem <= 0) m = 'заставка THE SHOW BEGINS (ждёт команды)';
    else if (tv.mode !== 'opening' && rem <= 120000) m = 'финальный отсчёт (авто, < 2 мин)';
    root.querySelector('#tv-mode').textContent = m;
  }

  function stop() { clearTimeout(pollT); clearInterval(tickT); root = null; }

  // ---------- QR ----------
  function quizUrl() { return (tv && tv.quizUrl) || new URL('./', location.href).href; }
  function loadQRLib() {
    if (window.qrcode) return;
    const srcs = ['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'];
    const next = () => { const src = srcs.shift(); if (!src) return; const s = document.createElement('script'); s.src = src; s.onload = drawQR; s.onerror = next; document.head.appendChild(s); };
    next();
  }
  function paint(canvas, url, size, margin) {
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(), cell = Math.floor((size - margin * 2) / n), off = Math.floor((size - cell * n) / 2);
    canvas.width = size; canvas.height = size;
    const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(off + c * cell, off + r * cell, cell, cell);
  }
  function drawQR() { if (!window.qrcode || !alive()) return; paint(root.querySelector('#tv-qr'), quizUrl(), 320, 12); }
  function downloadQR() {
    if (!window.qrcode) return toast('QR ещё загружается…');
    const c = document.createElement('canvas'); paint(c, quizUrl(), 1600, 120);
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'antoshkaallen-quiz-qr.png'; document.body.appendChild(a); a.click(); a.remove();
  }

  function toast(t) { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600); }

  return { mount };
})();
