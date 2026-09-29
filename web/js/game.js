// FantasyLand – a small top-down arena action game. No build step, no dependencies.
(() => {
  "use strict";

  // ---------- Setup ----------
  const W = 960, H = 540, MARGIN = 40;
  const SWING_TIME = 0.16, SWING_CD = 0.32, SWING_RANGE = 62, SWING_ARC = Math.PI * 0.75;

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  // ---------- Audio (tiny WebAudio synth, no asset files) ----------
  let audioCtx = null;
  let muted = store.get("fantasyland.muted") === "1";

  function tone(freq, dur, type, vol, slide = 0) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + dur);
    } catch { /* audio unavailable */ }
  }

  const SFX = {
    swing: () => tone(460, 0.08, "triangle", 0.05, -220),
    hit: () => tone(190, 0.08, "square", 0.05, -80),
    kill: () => tone(520, 0.14, "square", 0.045, 420),
    gem: () => tone(900, 0.08, "sine", 0.06, 300),
    heart: () => tone(640, 0.22, "sine", 0.07, 260),
    hurt: () => tone(130, 0.28, "sawtooth", 0.08, -70),
    fire: () => tone(260, 0.12, "sawtooth", 0.025, -120),
    wave: () => { tone(330, 0.18, "triangle", 0.07); setTimeout(() => tone(495, 0.3, "triangle", 0.07), 140); },
    over: () => { tone(300, 0.3, "triangle", 0.08, -150); setTimeout(() => tone(180, 0.5, "triangle", 0.08, -100), 250); },
  };

  // ---------- Pre-rendered background ----------
  const bg = document.createElement("canvas");
  bg.width = W * DPR;
  bg.height = H * DPR;
  (function drawBackground() {
    const b = bg.getContext("2d");
    b.scale(DPR, DPR);
    b.fillStyle = "#3f7d3a";
    b.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) {
      b.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
      b.fillRect(rand(0, W), rand(0, H), rand(2, 7), rand(2, 7));
    }
    b.strokeStyle = "rgba(25,70,28,0.55)";
    b.lineWidth = 1.2;
    for (let i = 0; i < 500; i++) {
      const x = rand(0, W), y = rand(0, H);
      b.beginPath();
      b.moveTo(x, y);
      b.lineTo(x + rand(-2, 2), y - rand(3, 6));
      b.stroke();
    }
    const petals = ["#f7d44c", "#f78fb3", "#ffffff", "#b3a4ff"];
    for (let i = 0; i < 80; i++) {
      const x = rand(MARGIN, W - MARGIN), y = rand(MARGIN, H - MARGIN);
      b.fillStyle = petals[i % petals.length];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        b.beginPath();
        b.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.9, 0, Math.PI * 2);
        b.fill();
      }
      b.fillStyle = "#f5a623";
      b.beginPath();
      b.arc(x, y, 1.4, 0, Math.PI * 2);
      b.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = rand(MARGIN + 20, W - MARGIN - 20), y = rand(MARGIN + 20, H - MARGIN - 20);
      const r = rand(4, 9);
      b.fillStyle = "rgba(0,0,0,0.2)";
      b.beginPath(); b.ellipse(x + 2, y + 3, r, r * 0.7, 0, 0, Math.PI * 2); b.fill();
      b.fillStyle = "#8a8f86";
      b.beginPath(); b.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); b.fill();
      b.fillStyle = "rgba(255,255,255,0.25)";
      b.beginPath(); b.ellipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.25, 0, 0, Math.PI * 2); b.fill();
    }
    const tree = (x, y, r) => {
      b.fillStyle = "rgba(0,0,0,0.28)";
      b.beginPath(); b.ellipse(x + 5, y + 7, r, r * 0.8, 0, 0, Math.PI * 2); b.fill();
      b.fillStyle = "#1c4623";
      b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
      b.fillStyle = "#2a6632";
      b.beginPath(); b.arc(x - r * 0.2, y - r * 0.2, r * 0.72, 0, Math.PI * 2); b.fill();
      b.fillStyle = "#3b8a43";
      b.beginPath(); b.arc(x - r * 0.35, y - r * 0.38, r * 0.35, 0, Math.PI * 2); b.fill();
    };
    for (let x = -10; x < W + 30; x += 28) {
      tree(x + rand(-6, 6), rand(0, 12), rand(20, 28));
      tree(x + rand(-6, 6), H - rand(0, 12), rand(20, 28));
    }
    for (let y = 20; y < H - 10; y += 28) {
      tree(rand(0, 12), y + rand(-6, 6), rand(20, 28));
      tree(W - rand(0, 12), y + rand(-6, 6), rand(20, 28));
    }
  })();

  // ---------- Enemy definitions ----------
  const ENEMY = {
    slime: { hp: 2, speed: 64, r: 14, score: 10, dmg: 1, color: "#5fcf5f", dark: "#2f8a3a" },
    bat: { hp: 1, speed: 135, r: 11, score: 15, dmg: 1, color: "#9a76e0", dark: "#5a3f99" },
    orc: { hp: 5, speed: 50, r: 20, score: 40, dmg: 2, color: "#7fa24a", dark: "#4e6a2a" },
    mage: { hp: 3, speed: 72, r: 14, score: 30, dmg: 1, color: "#d65a8e", dark: "#7e2450" },
    boss: { hp: 30, speed: 56, r: 38, score: 300, dmg: 2, color: "#c0392b", dark: "#6e1a12" },
  };

  // ---------- Game state ----------
  let state = "menu"; // menu | playing | paused | gameover
  let player, enemies, projectiles, drops, particles, texts;
  let score, wave, streak, streakTimer, spawnQueue, spawnTimer, waveBanner, betweenWaves, shake, kills, submitted;

  function newGame() {
    player = {
      x: W / 2, y: H / 2, r: 14, speed: 215, hp: 5, maxHp: 5,
      face: 0, cd: 0, swing: 0, swingAng: 0, swingId: 0, invuln: 0, walk: 0,
    };
    enemies = []; projectiles = []; drops = []; particles = []; texts = [];
    score = 0; wave = 0; streak = 0; streakTimer = 0; kills = 0; shake = 0;
    betweenWaves = 0; submitted = false;
    nextWave();
  }

  const multiplier = () => Math.min(5, 1 + Math.floor(streak / 5));

  function nextWave() {
    wave++;
    const q = [];
    const n = 4 + wave * 2;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let t = "slime";
      if (wave >= 2 && r < 0.3) t = "bat";
      else if (wave >= 3 && r > 0.82) t = "orc";
      else if (wave >= 4 && r > 0.66) t = "mage";
      q.push(t);
    }
    if (wave % 5 === 0) q.push("boss");
    spawnQueue = q;
    spawnTimer = 1.0;
    waveBanner = 2.2;
    SFX.wave();
  }

  function spawnEnemy(type) {
    const T = ENEMY[type];
    let x, y;
    // Spawn at an arena edge, away from the player.
    for (let tries = 0; tries < 8; tries++) {
      const side = randInt(0, 3);
      x = side < 2 ? rand(MARGIN + T.r, W - MARGIN - T.r) : side === 2 ? MARGIN + T.r : W - MARGIN - T.r;
      y = side >= 2 ? rand(MARGIN + T.r, H - MARGIN - T.r) : side === 0 ? MARGIN + T.r : H - MARGIN - T.r;
      if (dist2({ x, y }, player) > 200 * 200) break;
    }
    const hp = type === "boss" ? T.hp + wave * 5 : Math.ceil(T.hp * (1 + (wave - 1) * 0.12));
    enemies.push({
      type, x, y, r: T.r, hp, maxHp: hp,
      speed: T.speed * Math.min(1.6, 1 + (wave - 1) * 0.04),
      kx: 0, ky: 0, flash: 0, hitBy: -1, t: rand(0, 10), shoot: rand(1.5, 3), dead: false,
    });
    burst(x, y, "rgba(220,220,255,0.8)", 10, 80);
  }

  // ---------- Effects ----------
  function burst(x, y, color, n, speed = 160, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      const life = rand(0.3, 0.6);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(size * 0.6, size * 1.4) });
    }
  }

  function floatText(x, y, text, color = "#fff", size = 16) {
    texts.push({ x, y, text, color, size, life: 0.9 });
  }

  // ---------- Input ----------
  const keys = {};
  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    Space: "attack", KeyJ: "attack",
  };
  const mouse = { x: 0, y: 0, down: false, active: false };
  const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  let touchAttack = false;

  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === "KeyP" || e.code === "Escape") togglePause();
    if (e.code === "KeyM") toggleMute();
    if (e.code === "Enter" && state === "menu") startGame();
  });
  addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });
  addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    mouse.down = false;
    if (state === "playing") togglePause();
  });

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  canvas.addEventListener("pointerdown", (e) => {
    const p = toLocal(e);
    if (e.pointerType === "touch") {
      showTouchUI();
      mouse.active = false;
      if (p.x < W * 0.55 && stick.id === null) {
        stick.id = e.pointerId; stick.ox = p.x; stick.oy = p.y; stick.dx = 0; stick.dy = 0;
      } else {
        touchAttack = true;
        setTimeout(() => { touchAttack = false; }, 120);
      }
    } else {
      mouse.active = true; mouse.x = p.x; mouse.y = p.y; mouse.down = true;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toLocal(e);
    if (e.pointerId === stick.id) {
      let dx = (p.x - stick.ox) / 50, dy = (p.y - stick.oy) / 50;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      stick.dx = dx; stick.dy = dy;
    } else if (e.pointerType === "mouse") {
      mouse.active = true; mouse.x = p.x; mouse.y = p.y;
    }
  });
  const endPointer = (e) => {
    if (e.pointerId === stick.id) { stick.id = null; stick.dx = 0; stick.dy = 0; }
    else if (e.pointerType !== "touch") mouse.down = false;
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const attackBtn = $("btn-attack");
  attackBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); touchAttack = true; });
  attackBtn.addEventListener("pointerup", () => { touchAttack = false; });
  attackBtn.addEventListener("pointercancel", () => { touchAttack = false; });
  attackBtn.addEventListener("pointerleave", () => { touchAttack = false; });

  let touchUI = false;
  function showTouchUI() {
    touchUI = true;
    if (state === "playing") attackBtn.classList.remove("hidden");
  }
  addEventListener("touchstart", () => showTouchUI(), { once: true, passive: true });

  // ---------- Player actions ----------
  function aimAngle() {
    if (mouse.active) return Math.atan2(mouse.y - player.y, mouse.x - player.x);
    let best = null, bd = 150 * 150;
    for (const e of enemies) {
      const d = dist2(e, player);
      if (d < bd) { bd = d; best = e; }
    }
    return best ? Math.atan2(best.y - player.y, best.x - player.x) : player.face;
  }

  function attack() {
    player.cd = SWING_CD;
    player.swing = SWING_TIME;
    player.swingAng = aimAngle();
    player.swingId++;
    SFX.swing();
  }

  function inSwing(x, y, r) {
    const d = Math.hypot(x - player.x, y - player.y);
    if (d < player.r + r) return true;
    if (d > SWING_RANGE + r) return false;
    const a = Math.atan2(y - player.y, x - player.x);
    return Math.abs(angleDiff(a, player.swingAng)) < SWING_ARC / 2 + Math.atan2(r, d);
  }

  function hitEnemy(e) {
    e.hp -= 1;
    e.flash = 0.12;
    e.hitBy = player.swingId;
    const a = Math.atan2(e.y - player.y, e.x - player.x);
    const kb = e.type === "boss" ? 90 : 300;
    e.kx = Math.cos(a) * kb;
    e.ky = Math.sin(a) * kb;
    burst(e.x, e.y, "#fff7d6", 6, 180, 2.5);
    SFX.hit();
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    const T = ENEMY[e.type];
    e.dead = true;
    kills++;
    streak++;
    streakTimer = 2.2;
    const pts = T.score * multiplier();
    score += pts;
    floatText(e.x, e.y - e.r, `+${pts}`, multiplier() > 1 ? "#ffd84a" : "#fff");
    burst(e.x, e.y, T.color, e.type === "boss" ? 60 : 16, e.type === "boss" ? 320 : 200, 4);
    shake = Math.max(shake, e.type === "boss" ? 16 : 3);
    SFX.kill();
    const gems = e.type === "boss" ? 10 : Math.random() < 0.55 ? 1 : 0;
    for (let i = 0; i < gems; i++) {
      const a = rand(0, Math.PI * 2), s = rand(40, 160);
      drops.push({ kind: "gem", x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value: randInt(1, 4) * 5, t: 0 });
    }
    if (e.type === "boss" || (player.hp < player.maxHp && Math.random() < 0.07)) {
      drops.push({ kind: "heart", x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), value: 1, t: 0 });
    }
  }

  function hurtPlayer(dmg, from) {
    if (player.invuln > 0) return;
    player.hp -= dmg;
    player.invuln = 1.0;
    streak = 0;
    shake = 12;
    SFX.hurt();
    burst(player.x, player.y, "#ff5a5a", 14, 200, 3);
    floatText(player.x, player.y - 24, `-${dmg}`, "#ff6b6b", 18);
    if (from) {
      const a = Math.atan2(player.y - from.y, player.x - from.x);
      player.x = clamp(player.x + Math.cos(a) * 24, MARGIN + player.r, W - MARGIN - player.r);
      player.y = clamp(player.y + Math.sin(a) * 24, MARGIN + player.r, H - MARGIN - player.r);
    }
    if (player.hp <= 0) gameOver();
  }

  function shoot(from, angle, speed) {
    projectiles.push({ x: from.x, y: from.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 7, life: 5 });
  }

  // ---------- Update ----------
  function update(dt) {
    // Movement
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + stick.dx;
    let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + stick.dy;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    player.x = clamp(player.x + mx * player.speed * dt, MARGIN + player.r, W - MARGIN - player.r);
    player.y = clamp(player.y + my * player.speed * dt, MARGIN + player.r, H - MARGIN - player.r);
    if (len > 0.1) { player.face = Math.atan2(my, mx); player.walk += dt * 12; }

    player.cd -= dt;
    player.swing -= dt;
    player.invuln -= dt;
    if ((keys.attack || mouse.down || touchAttack) && player.cd <= 0) attack();

    // Streak
    if (streakTimer > 0) { streakTimer -= dt; if (streakTimer <= 0) streak = 0; }

    // Waves
    waveBanner -= dt;
    if (spawnQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy(spawnQueue.shift());
        spawnTimer = Math.max(0.28, 1.0 - wave * 0.05);
      }
    } else if (enemies.length === 0) {
      if (betweenWaves <= 0) betweenWaves = 1.6;
      betweenWaves -= dt;
      if (betweenWaves <= 0) nextWave();
    }

    // Enemies
    for (const e of enemies) {
      const T = ENEMY[e.type];
      e.t += dt;
      e.flash -= dt;
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      let vx = 0, vy = 0;
      switch (e.type) {
        case "slime": {
          const hop = Math.max(0, Math.sin(e.t * 5)) * 1.9;
          vx = ux * e.speed * hop; vy = uy * e.speed * hop;
          break;
        }
        case "bat": {
          const wob = Math.sin(e.t * 7) * 0.9;
          vx = (ux - uy * wob) * e.speed; vy = (uy + ux * wob) * e.speed;
          break;
        }
        case "mage": {
          const dir = d < 180 ? -1 : d > 270 ? 1 : 0;
          const strafe = Math.sin(e.t * 0.8) > 0 ? 1 : -1;
          vx = (ux * dir - uy * strafe * 0.6) * e.speed;
          vy = (uy * dir + ux * strafe * 0.6) * e.speed;
          e.shoot -= dt;
          if (e.shoot <= 0) {
            e.shoot = rand(2.0, 3.2);
            shoot(e, Math.atan2(dy, dx), 190 + wave * 4);
            SFX.fire();
          }
          break;
        }
        case "boss": {
          vx = ux * e.speed; vy = uy * e.speed;
          e.shoot -= dt;
          if (e.shoot <= 0) {
            e.shoot = 3.0;
            const n = 12, off = rand(0, Math.PI);
            for (let i = 0; i < n; i++) shoot(e, off + (i / n) * Math.PI * 2, 170);
            SFX.fire();
          }
          break;
        }
        default:
          vx = ux * e.speed; vy = uy * e.speed;
      }
      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      const decay = Math.min(1, dt * 9);
      e.kx -= e.kx * decay;
      e.ky -= e.ky * decay;
      e.x = clamp(e.x, MARGIN + e.r, W - MARGIN - e.r);
      e.y = clamp(e.y, MARGIN + e.r, H - MARGIN - e.r);

      if (player.swing > 0 && e.hitBy !== player.swingId && inSwing(e.x, e.y, e.r)) hitEnemy(e);
      if (!e.dead && d < e.r + player.r - 4) hurtPlayer(T.dmg, e);
      if (state !== "playing") return;
    }

    // Keep enemies from stacking on top of each other.
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2), push = (min - d) / 2;
          const wa = a.type === "boss" ? 0.1 : 1, wb = b.type === "boss" ? 0.1 : 1;
          a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
          b.x += (dx / d) * push * wb; b.y += (dy / d) * push * wb;
        }
      }
    }
    enemies = enemies.filter((e) => !e.dead);

    // Projectiles
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (Math.random() < 0.5) particles.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.25, max: 0.25, color: "#ffb347", size: 3 });
      if (player.swing > 0 && inSwing(p.x, p.y, p.r)) {
        p.life = 0;
        burst(p.x, p.y, "#ffd27a", 8, 140, 2);
        score += 2;
      } else if (dist2(p, player) < (p.r + player.r - 3) ** 2) {
        p.life = 0;
        hurtPlayer(1, p);
        if (state !== "playing") return;
      }
    }
    projectiles = projectiles.filter((p) => p.life > 0 && p.x > 0 && p.x < W && p.y > 0 && p.y < H);

    // Drops
    for (const g of drops) {
      g.t += dt;
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.vx *= 1 - Math.min(1, dt * 4); g.vy *= 1 - Math.min(1, dt * 4);
      g.x = clamp(g.x, MARGIN + 6, W - MARGIN - 6);
      g.y = clamp(g.y, MARGIN + 6, H - MARGIN - 6);
      const d = Math.sqrt(dist2(g, player));
      if (d < 95 && g.t > 0.3) {
        const s = 360 * dt / (d || 1);
        g.x += (player.x - g.x) * Math.min(1, s);
        g.y += (player.y - g.y) * Math.min(1, s);
      }
      if (d < player.r + 10 && g.t > 0.3) {
        g.taken = true;
        if (g.kind === "gem") {
          score += g.value;
          floatText(g.x, g.y - 10, `+${g.value}`, "#7fe7ff", 14);
          SFX.gem();
        } else {
          player.hp = Math.min(player.maxHp, player.hp + 1);
          floatText(g.x, g.y - 10, "+♥", "#ff8fa3", 16);
          SFX.heart();
        }
      }
    }
    drops = drops.filter((g) => !g.taken && g.t < 12);

    // Particles & floating text
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const t of texts) { t.y -= 40 * dt; t.life -= dt; }
    texts = texts.filter((t) => t.life > 0);

    shake = Math.max(0, shake - dt * 40);
  }

  // ---------- Rendering ----------
  function shadow(x, y, r) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function eyes(x, y, ang, spread, size, color = "#111") {
    const fx = Math.cos(ang) * size * 0.9, fy = Math.sin(ang) * size * 0.6;
    ctx.fillStyle = "#fff";
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(x + s * spread + fx * 0.5, y + fy * 0.5, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = color;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(x + s * spread + fx, y + fy, size * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    const bob = Math.sin(p.walk) * 2;
    shadow(p.x, p.y, p.r);
    // cape
    ctx.fillStyle = "#b8322a";
    ctx.beginPath();
    ctx.ellipse(p.x - Math.cos(p.face) * 5, p.y + 3 + bob - Math.sin(p.face) * 3, p.r * 0.95, p.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = "#3b6fd6";
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5b8ef0";
    ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4 + bob, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
    // helmet
    ctx.fillStyle = "#c9d1d9";
    ctx.beginPath(); ctx.arc(p.x, p.y - 8 + bob, p.r * 0.72, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(p.x - 1.5, p.y - 20 + bob, 3, 6);
    eyes(p.x, p.y - 2 + bob, p.face, 4.5, 3);

    // sword + slash arc
    const prog = p.swing > 0 ? 1 - p.swing / SWING_TIME : -1;
    const aim = prog >= 0 ? p.swingAng - SWING_ARC / 2 + SWING_ARC * prog : (mouse.active ? Math.atan2(mouse.y - p.y, mouse.x - p.x) : p.face) + 0.9;
    const sx = p.x + Math.cos(aim) * (p.r + 2), sy = p.y + bob + Math.sin(aim) * (p.r + 2);
    const len = prog >= 0 ? SWING_RANGE - 8 : 22;
    ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(aim) * len, sy + Math.sin(aim) * len); ctx.stroke();
    ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx - Math.cos(aim) * 4, sy - Math.sin(aim) * 4); ctx.lineTo(sx + Math.cos(aim) * 2, sy + Math.sin(aim) * 2); ctx.stroke();
    if (prog >= 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - prog) + 0.15})`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, SWING_RANGE - 10, p.swingAng - SWING_ARC / 2, p.swingAng - SWING_ARC / 2 + SWING_ARC * prog);
      ctx.stroke();
    }
  }

  function drawEnemy(e) {
    const T = ENEMY[e.type];
    const flash = e.flash > 0;
    const body = flash ? "#ffffff" : T.color;
    const dark = flash ? "#ffffff" : T.dark;
    const look = Math.atan2(player.y - e.y, player.x - e.x);
    shadow(e.x, e.y, e.r);
    switch (e.type) {
      case "slime": {
        const hop = Math.max(0, Math.sin(e.t * 5));
        const sy = 1 - hop * 0.18, lift = hop * 8;
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.ellipse(e.x, e.y - lift + 2, e.r * (2 - sy) * 0.95, e.r * sy, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(e.x, e.y - lift, e.r * (2 - sy) * 0.9, e.r * sy * 0.92, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath(); ctx.ellipse(e.x - 5, e.y - lift - 5, 4, 2.5, -0.5, 0, Math.PI * 2); ctx.fill();
        eyes(e.x, e.y - lift - 1, look, 4.5, 2.6);
        break;
      }
      case "bat": {
        const flap = Math.sin(e.t * 22) * 7;
        ctx.fillStyle = dark;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(e.x + s * 5, e.y - 8);
          ctx.lineTo(e.x + s * 22, e.y - 10 - flap);
          ctx.lineTo(e.x + s * 16, e.y + 2 - flap * 0.3);
          ctx.lineTo(e.x + s * 5, e.y + 2);
          ctx.fill();
        }
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(e.x, e.y - 4, e.r, 0, Math.PI * 2); ctx.fill();
        eyes(e.x, e.y - 5, look, 3.5, 2.4, "#c0122c");
        break;
      }
      case "orc": {
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.arc(e.x, e.y + 2, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.92, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5a3b1f";
        ctx.fillRect(e.x - e.r * 0.8, e.y - e.r * 0.75, e.r * 1.6, 5);
        eyes(e.x, e.y - 4, look, 6, 3, "#b01919");
        ctx.fillStyle = flash ? "#fff" : "#f3ecd2";
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(e.x + s * 6, e.y + 6); ctx.lineTo(e.x + s * 8, e.y - 1); ctx.lineTo(e.x + s * 3, e.y + 6); ctx.fill();
        }
        break;
      }
      case "mage": {
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r - 14); ctx.lineTo(e.x + e.r + 2, e.y + e.r); ctx.lineTo(e.x - e.r - 2, e.y + e.r); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2b1633";
        ctx.beginPath(); ctx.arc(e.x, e.y - 1, e.r * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffcc33";
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(e.x + s * 3.5, e.y - 1, 1.8, 0, Math.PI * 2); ctx.fill(); }
        const glow = 4 + Math.sin(e.t * 6) * 1.5;
        ctx.fillStyle = "rgba(255,160,60,0.9)";
        ctx.beginPath(); ctx.arc(e.x + e.r + 4, e.y - 6, glow, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "boss": {
        ctx.fillStyle = flash ? "#fff" : "#3a2a1a";
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(e.x + s * 14, e.y - e.r + 8);
          ctx.quadraticCurveTo(e.x + s * 40, e.y - e.r - 10, e.x + s * 30, e.y - e.r - 26);
          ctx.lineTo(e.x + s * 24, e.y - e.r + 4);
          ctx.fill();
        }
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.arc(e.x, e.y + 3, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.93, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? "#fff" : "#f5c542";
        ctx.beginPath();
        ctx.moveTo(e.x - 18, e.y - e.r + 6);
        for (let i = 0; i <= 4; i++) ctx.lineTo(e.x - 18 + i * 9, e.y - e.r - (i % 2 === 0 ? 14 : 2));
        ctx.lineTo(e.x + 18, e.y - e.r + 6);
        ctx.fill();
        eyes(e.x, e.y - 6, look, 11, 6, "#ffdd00");
        ctx.fillStyle = "#2a0b07";
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, 14, 6 + Math.sin(e.t * 4) * 2, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    if (e.type !== "boss" && e.hp < e.maxHp) {
      const w = e.r * 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 4);
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * (e.hp / e.maxHp), 4);
    }
  }

  function drawDrop(g) {
    if (g.t > 9 && Math.floor(g.t * 8) % 2 === 0) return;
    const bob = Math.sin(g.t * 5) * 2;
    shadow(g.x, g.y, 6);
    if (g.kind === "gem") {
      ctx.fillStyle = "#4fd8ff";
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - 8 + bob); ctx.lineTo(g.x + 6, g.y - 1 + bob);
      ctx.lineTo(g.x, g.y + 7 + bob); ctx.lineTo(g.x - 6, g.y - 1 + bob);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.moveTo(g.x, g.y - 6 + bob); ctx.lineTo(g.x + 3, g.y - 1 + bob); ctx.lineTo(g.x, g.y + bob); ctx.fill();
    } else {
      drawHeart(g.x, g.y + bob - 2, 8, "#ff4d6d");
    }
  }

  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
    ctx.fill();
  }

  function text(str, x, y, size, color = "#fff", align = "left") {
    ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawHUD() {
    for (let i = 0; i < player.maxHp; i++) {
      drawHeart(24 + i * 26, 22, 10, "rgba(0,0,0,0.45)");
      if (i < player.hp) drawHeart(24 + i * 26, 22, 9, "#ff4d6d");
    }
    text(`Wave ${wave}`, 16, 50, 16, "#f3efe0");
    text(`${score}`, W - 16, 22, 26, "#ffd84a", "right");
    text(`Hạ gục: ${kills}`, W - 16, 50, 14, "#f3efe0", "right");
    if (multiplier() > 1) text(`Combo x${multiplier()}`, W - 16, 72, 16, "#ff9f43", "right");

    const boss = enemies.find((e) => e.type === "boss");
    if (boss) {
      const w = 360, x = W / 2 - w / 2, y = H - 26;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - 2, y - 2, w + 4, 14);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(x, y, w * (boss.hp / boss.maxHp), 10);
      text("Vua Quỷ Đỏ", W / 2, y - 12, 14, "#ffb3a7", "center");
    }

    if (waveBanner > 0) {
      const a = Math.min(1, waveBanner * 2, (2.2 - waveBanner) * 4);
      ctx.globalAlpha = Math.max(0, a);
      text(`Wave ${wave}`, W / 2, H / 2 - 40, 48, "#ffd84a", "center");
      if (wave % 5 === 0) text("Trùm xuất hiện!", W / 2, H / 2 + 6, 22, "#ff7b6b", "center");
      ctx.globalAlpha = 1;
    }

    if (stick.id !== null) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 50, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.arc(stick.ox + stick.dx * 50, stick.oy + stick.dy * 50, 20, 0, Math.PI * 2); ctx.fill();
    }
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    ctx.drawImage(bg, 0, 0, W, H);
    if (player) {
      for (const g of drops) drawDrop(g);
      const actors = [...enemies, player].sort((a, b) => a.y - b.y);
      for (const a of actors) (a === player ? drawPlayer() : drawEnemy(a));
      for (const p of projectiles) {
        ctx.fillStyle = "#ff7a1a";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (const t of texts) {
        ctx.globalAlpha = Math.min(1, t.life * 2);
        text(t.text, t.x, t.y, t.size, t.color, "center");
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (player && state !== "menu") drawHUD();
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === "playing") update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------- UI / screens ----------
  const screens = { menu: $("menu"), pause: $("pause"), gameover: $("gameover") };
  function show(name) {
    for (const [k, el] of Object.entries(screens)) el.classList.toggle("hidden", k !== name);
    attackBtn.classList.toggle("hidden", !(touchUI && name === null));
  }

  function startGame() {
    newGame();
    state = "playing";
    show(null);
  }

  function togglePause() {
    if (state === "playing") { state = "paused"; show("pause"); }
    else if (state === "paused") { state = "playing"; last = performance.now(); show(null); }
  }

  function toMenu() {
    state = "menu";
    player = null;
    show("menu");
    renderBoard($("board-menu"));
  }

  function gameOver() {
    state = "gameover";
    SFX.over();
    setTimeout(() => {
      show("gameover");
      $("final").innerHTML = `Điểm: <b>${score}</b> · Wave <b>${wave}</b> · Hạ gục <b>${kills}</b>`;
      $("submit-msg").textContent = "";
      $("btn-submit").disabled = false;
      $("name").value = store.get("fantasyland.name") || "";
      renderBoard($("board-over"));
    }, 700);
  }

  function toggleMute() {
    muted = !muted;
    store.set("fantasyland.muted", muted ? "1" : "0");
    $("btn-mute").textContent = muted ? "🔇" : "🔊";
  }

  async function renderBoard(ol, highlight) {
    const status = ol.parentElement.querySelector(".board-status");
    status.textContent = window.Leaderboard.online
      ? "🌐 Bảng xếp hạng online (Supabase)"
      : "💾 Điểm chỉ lưu trên máy này (chưa cấu hình backend)";
    ol.replaceChildren(listItem("Đang tải…"));
    try {
      const rows = await window.Leaderboard.top(10);
      if (!rows.length) { ol.replaceChildren(listItem("Chưa có ai – hãy là người đầu tiên!")); return; }
      ol.replaceChildren(...rows.map((r) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "name"; name.textContent = r.name;
        const sc = document.createElement("span");
        sc.className = "score"; sc.textContent = r.score;
        const wv = document.createElement("span");
        wv.className = "wave"; wv.textContent = `W${r.wave}`;
        if (highlight && r.name === highlight.name && r.score === highlight.score) li.classList.add("me");
        li.append(name, sc, wv);
        return li;
      }));
    } catch (err) {
      console.error(err);
      ol.replaceChildren(listItem("Không tải được bảng xếp hạng."));
    }
  }

  function listItem(msg) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = msg;
    return li;
  }

  $("btn-play").addEventListener("click", startGame);
  $("btn-again").addEventListener("click", startGame);
  $("btn-resume").addEventListener("click", togglePause);
  $("btn-quit").addEventListener("click", toMenu);
  $("btn-menu").addEventListener("click", toMenu);
  $("btn-mute").addEventListener("click", (e) => { toggleMute(); e.currentTarget.blur(); });
  $("btn-mute").textContent = muted ? "🔇" : "🔊";

  $("submit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitted) return;
    const name = window.Leaderboard.cleanName($("name").value);
    if (!name) return;
    const btn = $("btn-submit"), msg = $("submit-msg");
    btn.disabled = true;
    msg.textContent = "Đang lưu…";
    try {
      await window.Leaderboard.submit(name, score, wave);
      submitted = true;
      store.set("fantasyland.name", name);
      msg.textContent = "✅ Đã lưu điểm!";
      renderBoard($("board-over"), { name, score });
    } catch (err) {
      console.error(err);
      msg.textContent = "❌ Lưu thất bại, thử lại nhé.";
      btn.disabled = false;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") togglePause();
  });

  toMenu();
  requestAnimationFrame(frame);
})();
