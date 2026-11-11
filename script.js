(() => {
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Wizard mode is built but hidden for now; flip to true (and remove `hidden` on its button) to bring it back
  const WIZARD_ENABLED = false;
  const THEMES = WIZARD_ENABLED ? ['light', 'dark', 'wizard'] : ['light', 'dark'];

  /* ---------------- Theme ---------------- */
  const buttons = document.querySelectorAll('[data-set-theme]');

  function setTheme(theme, { announce = false, origin } = {}) {
    if (!THEMES.includes(theme)) return;
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    buttons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.setTheme === theme)));
    restartTyper();
    fx.onTheme(theme, origin);
    if (announce) toast(TOASTS[theme]);
  }

  const TOASTS = {
    light: 'Lumos ✦ lights on',
    dark: 'Nox ✦ lights off',
    wizard: 'Welcome to the castle. Mind the moving staircases.',
  };

  buttons.forEach(b => b.addEventListener('click', e => {
    const r = b.getBoundingClientRect();
    setTheme(b.dataset.setTheme, { announce: b.dataset.setTheme === 'wizard', origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
  }));

  /* Typed spells: lumos / nox / accio (wizard) */
  const SPELLS = { lumos: 'light', nox: 'dark', accio: 'wizard', alohomora: 'wizard' };
  let typed = '';
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, [contenteditable]') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-12);
    for (const [spell, theme] of Object.entries(SPELLS)) {
      if (typed.endsWith(spell)) {
        typed = '';
        setTheme(theme, { announce: true, origin: { x: innerWidth / 2, y: innerHeight / 2 } });
      }
    }
  });

  /* ---------------- Portrait: subtle tilt ---------------- */
  const portrait = document.querySelector('.portrait');
  const frame = portrait && portrait.querySelector('.portrait-frame');

  if (frame && !reducedMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let tiltRaf;
    portrait.addEventListener('pointermove', e => {
      const r = portrait.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - .5;   // -0.5 … 0.5
      const ny = (e.clientY - r.top) / r.height - .5;
      cancelAnimationFrame(tiltRaf);
      tiltRaf = requestAnimationFrame(() => {
        frame.style.setProperty('--ry', (nx * 6).toFixed(2) + 'deg');
        frame.style.setProperty('--rx', (-ny * 5).toFixed(2) + 'deg');
        frame.style.setProperty('--px', (-nx * 10).toFixed(1) + 'px');
        frame.style.setProperty('--py', (-ny * 8).toFixed(1) + 'px');
      });
    });
    portrait.addEventListener('pointerleave', () => {
      cancelAnimationFrame(tiltRaf);
      ['--rx', '--ry', '--px', '--py'].forEach(p => frame.style.removeProperty(p));
    });
  }

  /* ---------------- Toast ---------------- */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------------- Typewriter ---------------- */
  const ROLES = {
    pro: ['AI/ML Engineer', 'Agentic systems builder', 'Data Scientist', 'LLM evaluation nerd', 'Forecasting + MLOps'],
    wiz: ['Summoner of agents', 'Brewer of forecasts', 'Keeper of pipelines', 'Breaker of baselines', 'Apprentice of the Arcane Data Arts'],
  };
  const typer = document.getElementById('typer');
  let typerTimer;

  function restartTyper() {
    clearTimeout(typerTimer);
    const list = root.dataset.theme === 'wizard' ? ROLES.wiz : ROLES.pro;
    if (reducedMotion) { typer.textContent = list[0]; return; }
    let i = 0, j = 0, deleting = false;
    (function tick() {
      const word = list[i];
      j += deleting ? -1 : 1;
      typer.textContent = word.slice(0, j);
      let delay = deleting ? 35 : 70;
      if (!deleting && j === word.length) { deleting = true; delay = 1600; }
      else if (deleting && j === 0) { deleting = false; i = (i + 1) % list.length; delay = 300; }
      typerTimer = setTimeout(tick, delay);
    })();
  }

  /* ---------------- Count-up stats ---------------- */
  function countUp(el) {
    const to = parseFloat(el.dataset.to);
    const from = parseFloat(el.dataset.from || 0);
    const dec = parseInt(el.dataset.decimals || 0, 10);
    const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (reducedMotion) { el.textContent = fmt(to); return; }
    const start = performance.now(), dur = 1400;
    (function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ---------------- Reveal on scroll ---------------- */
  const revealTargets = document.querySelectorAll('.card, .section-head, .stats');
  revealTargets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      entry.target.querySelectorAll('.count').forEach(countUp);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  revealTargets.forEach(el => io.observe(el));

  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ===========================================================
     Background effects (canvas)
     - dark:   slow drifting motes
     - wizard: twinkling stars, floating candles, wand sparkle trail
     - light:  nothing (stay clean)
     =========================================================== */
  const fx = (() => {
    const canvas = document.getElementById('fx');
    const ctx = canvas.getContext('2d');
    let w, h, dpr, raf;
    let stars = [], candles = [], motes = [], sparks = [];
    let mode = null;

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      seed();
    }

    const rand = (a, b) => a + Math.random() * (b - a);

    function seed() {
      const area = (innerWidth * innerHeight) / 10000;
      stars = Array.from({ length: Math.round(area * 1.4) }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(.3, 1.4) * dpr, p: rand(0, Math.PI * 2), s: rand(.5, 2),
      }));
      const nCandles = innerWidth < 700 ? 5 : 11;
      candles = Array.from({ length: nCandles }, () => ({
        x: rand(0, w), y: rand(0, h), z: rand(.45, 1), p: rand(0, Math.PI * 2), vy: rand(.04, .12),
      }));
      motes = Array.from({ length: Math.round(area * .5) }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(.5, 1.6) * dpr, vx: rand(-.08, .08), vy: rand(-.15, -.03),
      }));
    }

    function drawCandle(c, t) {
      const s = c.z * dpr;
      const bob = Math.sin(t * .0008 + c.p) * 8 * s;
      const x = c.x, y = c.y + bob;
      const bw = 9 * s, bh = 46 * s;
      ctx.globalAlpha = .35 + c.z * .55;

      // glow
      const g = ctx.createRadialGradient(x, y - bh / 2 - 6 * s, 0, x, y - bh / 2 - 6 * s, 60 * s);
      g.addColorStop(0, 'rgba(255, 200, 110, .35)');
      g.addColorStop(1, 'rgba(255, 200, 110, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 60 * s, y - bh / 2 - 66 * s, 120 * s, 120 * s);

      // body
      const body = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
      body.addColorStop(0, '#d9ccb0'); body.addColorStop(.5, '#fbf3df'); body.addColorStop(1, '#c4b593');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 2 * s);
      ctx.fill();

      // flame (flickers)
      const flick = 1 + Math.sin(t * .02 + c.p * 7) * .12 + Math.sin(t * .051 + c.p) * .06;
      const fy = y - bh / 2 - 2 * s;
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.ellipse(x, fy - 6 * s * flick, 3.2 * s, 7 * s * flick, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath();
      ctx.ellipse(x, fy - 4.5 * s * flick, 1.4 * s, 3.5 * s * flick, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function frame(t) {
      ctx.clearRect(0, 0, w, h);

      if (mode === 'wizard') {
        for (const s of stars) {
          const a = .35 + .65 * Math.abs(Math.sin(t * .001 * s.s + s.p));
          ctx.fillStyle = `rgba(255, 244, 214, ${a})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
        for (const c of candles) {
          c.y -= c.vy * dpr;
          if (c.y < -80 * dpr) { c.y = h + 80 * dpr; c.x = rand(0, w); }
          drawCandle(c, t);
        }
      } else if (mode === 'dark') {
        ctx.fillStyle = 'rgba(160, 170, 255, .35)';
        for (const m of motes) {
          m.x += m.vx * dpr; m.y += m.vy * dpr;
          if (m.y < 0) { m.y = h; m.x = rand(0, w); }
          if (m.x < 0) m.x = w; if (m.x > w) m.x = 0;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        }
      }

      // sparks (wand trail + theme burst) — drawn in any mode while alive
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx; p.y += p.vy; p.vy += .03 * dpr; p.life -= p.decay;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        drawStar(p.x, p.y, p.r * p.life);
      }
      ctx.globalAlpha = 1;

      const idle = mode === 'light' && sparks.length === 0;
      raf = idle ? null : requestAnimationFrame(frame);
    }

    function drawStar(x, y, r) {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    }

    const SPARK_COLORS = ['#fff3cf', '#f6d98a', '#e8c06a', '#ffffff'];
    function emit(x, y, n, speed) {
      for (let k = 0; k < n; k++) {
        const a = rand(0, Math.PI * 2), v = rand(.2, speed) * dpr;
        sparks.push({
          x: x * dpr, y: y * dpr, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .4 * dpr,
          r: rand(2, 5) * dpr, life: 1, decay: rand(.012, .03),
          color: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
        });
      }
      if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
      start();
    }

    function start() { if (!raf && !reducedMotion) raf = requestAnimationFrame(frame); }

    let lastMove = 0;
    addEventListener('pointermove', e => {
      if (mode !== 'wizard' || reducedMotion || e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - lastMove < 16) return;
      lastMove = now;
      emit(e.clientX, e.clientY, 2, 1.2);
    });

    addEventListener('click', e => {
      if (mode === 'wizard' && !reducedMotion) emit(e.clientX, e.clientY, 18, 3.5);
    });

    addEventListener('resize', resize);
    resize();

    return {
      onTheme(theme, origin) {
        mode = theme;
        if (reducedMotion) {
          ctx.clearRect(0, 0, w, h);
          if (theme === 'wizard') { mode = 'wizard'; frame(0); cancelAnimationFrame(raf); raf = null; }
          return;
        }
        if (theme === 'wizard' && origin) emit(origin.x, origin.y, 60, 6);
        if (theme === 'light') ctx.clearRect(0, 0, w, h);
        start();
      },
    };
  })();

  const initial = root.getAttribute('data-theme');
  setTheme(THEMES.includes(initial) ? initial : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
})();
