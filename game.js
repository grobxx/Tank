const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreTop = document.getElementById("scoreTop");
const livesTop = document.getElementById("livesTop");
const worldTop = document.getElementById("worldTop");
const bonusText = document.getElementById("bonusText");
const streakText = document.getElementById("streakText");
const scoreSide = document.getElementById("scoreSide");
const p1Info = document.getElementById("p1Info");
const heartsHud = document.getElementById("heartsHud");
const ammoText = document.getElementById("ammoText");
const restartBtn = document.getElementById("restartBtn");
const pauseBtn = document.getElementById("pauseBtn");

const playerNameInput = document.getElementById("playerNameInput");
const playerColorInput = document.getElementById("playerColorInput");
const player2NameInput = document.getElementById("player2NameInput");
const player2ColorInput = document.getElementById("player2ColorInput");
const enemyColorInput = document.getElementById("enemyColorInput");
const difficultyRange = document.getElementById("difficultyRange");
const difficultyText = document.getElementById("difficultyText");
const enemyCountRange = document.getElementById("enemyCountRange");
const enemyCountText = document.getElementById("enemyCountText");
const mapGrassBtn = document.getElementById("mapGrassBtn");
const mapDesertBtn = document.getElementById("mapDesertBtn");
const modeCampaignBtn = document.getElementById("modeCampaignBtn");
const modeDuelBtn = document.getElementById("modeDuelBtn");
const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const helpCloseBtn = document.getElementById("helpCloseBtn");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const MAX_HEARTS = 10;
const ENEMY_BULLET_SPEED = 144;
const ENEMY_FIRE_MULT = 2;

const TUNNELS = [
  { x: 32, y: 32, dir: Math.atan2(H - 64, W - 64) },
  { x: W - 32, y: 32, dir: Math.atan2(H - 64, -(W - 64)) },
  { x: 32, y: H - 32, dir: Math.atan2(-(H - 64), W - 64) },
  { x: W - 32, y: H - 32, dir: Math.atan2(-(H - 64), -(W - 64)) },
];

const state = {
  gameMode: "campaign",
  mapKind: "grass",
  score: 0,
  streak: 0,
  world: 1,
  stage: 1,
  over: false,
  paused: false,
  hearts1: MAX_HEARTS,
  hearts2: MAX_HEARTS,
  player1: null,
  player2: null,
  enemies: [],
  bullets: [],
  walls: [],
  spawnQueue: 0,
  spawnCd: 0,
  spawnIdx: 0,
  enemyColor: "#d84315",
  player1Color: "#8bc34a",
  player2Color: "#42a5f5",
  player1Name: "P1",
  player2Name: "P2",
  enemyCount: 10,
  diff: 1,
  duelWinner: null,
};

function rnd(min, max) {
  return Math.random() * (max - min) + min;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function heartsLine(v) {
  const halfSteps = Math.round(clamp(v, 0, MAX_HEARTS) * 2);
  const full = Math.floor(halfSteps / 2);
  const half = halfSteps % 2;
  const empty = MAX_HEARTS - full - half;
  return "❤".repeat(full) + (half ? "🩷" : "") + "♡".repeat(empty);
}

function tankRect(t) {
  return { x: t.x - t.size / 2, y: t.y - t.size / 2, w: t.size, h: t.size };
}
function collideRect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function canMoveTo(x, y, size) {
  const r = size / 2;
  if (x < r + 4 || y < r + 4 || x > W - r - 4 || y > H - r - 4) return false;
  for (const w of state.walls) {
    const box = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    if (collideRect(box, w)) return false;
  }
  return true;
}

function buildMap() {
  state.walls = [];
  const rows = state.mapKind === "desert" ? 12 : 8;
  for (let i = 0; i < rows; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      let tries = 0;
      while (tries < 80) {
        tries += 1;
        const x = rnd(80, W - 120);
        const y = rnd(80, H - 120);
        let ok = true;
        for (const t of TUNNELS) if (dist(x, y, t.x, t.y) < 130) ok = false;
        for (const w of state.walls) if (dist(x, y, w.x, w.y) < 42) ok = false;
        if (!ok) continue;
        state.walls.push({ x: x - 18, y: y - 8, w: 36, h: 16 });
        break;
      }
    }
  }
}

function spawnEnemy() {
  const t = TUNNELS[state.spawnIdx % 4];
  state.spawnIdx += 1;
  const ux = Math.cos(t.dir);
  const uy = Math.sin(t.dir);
  const base = 92 + state.stage * 6 + rnd(0, 18);
  state.enemies.push({
    x: t.x - ux * 75,
    y: t.y - uy * 75,
    size: 20,
    dir: t.dir,
    speed: base * (1 + (state.diff - 1) * 0.35),
    fireCd: rnd(0.8, 1.6) * ENEMY_FIRE_MULT,
    cornerX: t.x,
    cornerY: t.y,
    emerging: true,
    emerge: 0,
    color: state.enemyColor,
  });
}

function shoot(shooter, slot) {
  const speed = slot === 0 ? ENEMY_BULLET_SPEED : 420;
  const d = shooter.dir;
  state.bullets.push({
    x: shooter.x + Math.cos(d) * shooter.size * 0.6,
    y: shooter.y + Math.sin(d) * shooter.size * 0.6,
    vx: Math.cos(d) * speed,
    vy: Math.sin(d) * speed,
    slot,
    r: 4,
  });
}

function resetGame() {
  state.gameMode = modeDuelBtn.classList.contains("active") ? "duel" : "campaign";
  state.mapKind = mapDesertBtn.classList.contains("active") ? "desert" : "grass";
  state.player1Name = playerNameInput.value.trim() || "P1";
  state.player2Name = player2NameInput.value.trim() || "P2";
  state.player1Color = playerColorInput.value;
  state.player2Color = player2ColorInput.value;
  state.enemyColor = enemyColorInput.value;
  state.enemyCount = Number(enemyCountRange.value);
  state.diff = Number(difficultyRange.value);

  state.score = 0;
  state.streak = 0;
  state.world = 1;
  state.stage = 1;
  state.hearts1 = MAX_HEARTS;
  state.hearts2 = MAX_HEARTS;
  state.over = false;
  state.paused = false;
  state.duelWinner = null;
  state.bullets = [];
  state.enemies = [];
  state.spawnQueue = 0;
  state.spawnCd = 0.2;
  state.spawnIdx = 0;

  state.player1 = { x: W * 0.16, y: H * 0.72, size: 22, dir: 0, speed: 170, reload: 0 };
  state.player2 = state.gameMode === "duel" ? { x: W * 0.84, y: H * 0.28, size: 22, dir: Math.PI, speed: 170, reload: 0 } : null;

  buildMap();
  if (state.gameMode === "campaign") state.spawnQueue = state.enemyCount + state.stage * 2;
  pauseBtn.textContent = "PAUSE";
}

function moveTank(t, dx, dy, dt) {
  if (!dx && !dy) return;
  const l = Math.hypot(dx, dy);
  dx /= l;
  dy /= l;
  t.dir = Math.atan2(dy, dx);
  const nx = t.x + dx * t.speed * dt;
  if (canMoveTo(nx, t.y, t.size)) t.x = nx;
  const ny = t.y + dy * t.speed * dt;
  if (canMoveTo(t.x, ny, t.size)) t.y = ny;
}

function updatePlayers(dt) {
  const p1 = state.player1;
  p1.reload -= dt;
  let dx = 0;
  let dy = 0;
  if (keys.has("KeyW")) dy -= 1;
  if (keys.has("KeyS")) dy += 1;
  if (keys.has("KeyA")) dx -= 1;
  if (keys.has("KeyD")) dx += 1;
  if (state.gameMode !== "duel") {
    if (keys.has("ArrowUp")) dy -= 1;
    if (keys.has("ArrowDown")) dy += 1;
    if (keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("ArrowRight")) dx += 1;
  }
  const old = p1.speed;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) p1.speed *= 0.5;
  moveTank(p1, dx, dy, dt);
  p1.speed = old;
  if (keys.has("Space") && p1.reload <= 0) {
    shoot(p1, 1);
    p1.reload = 0.18;
  }

  if (!state.player2) return;
  const p2 = state.player2;
  p2.reload -= dt;
  let dx2 = 0;
  let dy2 = 0;
  if (keys.has("ArrowUp")) dy2 -= 1;
  if (keys.has("ArrowDown")) dy2 += 1;
  if (keys.has("ArrowLeft")) dx2 -= 1;
  if (keys.has("ArrowRight")) dx2 += 1;
  moveTank(p2, dx2, dy2, dt);
  if ((keys.has("Enter") || keys.has("NumpadEnter")) && p2.reload <= 0) {
    shoot(p2, 2);
    p2.reload = 0.18;
  }
}

function updateEnemies(dt) {
  if (state.gameMode !== "campaign") return;
  const p = state.player1;
  state.spawnCd -= dt;
  if (state.spawnQueue > 0 && state.spawnCd <= 0) {
    spawnEnemy();
    state.spawnQueue -= 1;
    state.spawnCd = 1.1;
  }
  for (const e of state.enemies) {
    if (e.emerging) {
      e.emerge += dt * 0.7;
      e.x = e.cornerX + (e.x - e.cornerX) * (1 - e.emerge);
      e.y = e.cornerY + (e.y - e.cornerY) * (1 - e.emerge);
      if (e.emerge >= 1) e.emerging = false;
      continue;
    }
    let tx = p.x;
    let ty = p.y;
    let best = { x: tx, y: ty, d: dist(e.x, e.y, tx, ty) };
    const dirs = [[44, 0], [-44, 0], [0, 44], [0, -44], [36, 36], [36, -36], [-36, 36], [-36, -36]];
    for (const d of dirs) {
      const cx = e.x + d[0];
      const cy = e.y + d[1];
      if (!canMoveTo(cx, cy, e.size)) continue;
      const dd = dist(cx, cy, tx, ty);
      if (dd < best.d) best = { x: cx, y: cy, d: dd };
    }
    const ang = Math.atan2(best.y - e.y, best.x - e.x);
    e.dir = ang;
    const nx = e.x + Math.cos(ang) * e.speed * dt;
    const ny = e.y + Math.sin(ang) * e.speed * dt;
    if (canMoveTo(nx, ny, e.size)) {
      e.x = nx;
      e.y = ny;
    }
    e.fireCd -= dt;
    if (e.fireCd <= 0) {
      shoot(e, 0);
      e.fireCd = rnd(0.5, 1.2) * ENEMY_FIRE_MULT;
    }
  }
}

function updateBullets(dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  state.bullets = state.bullets.filter((b) => b.x > -12 && b.y > -12 && b.x < W + 12 && b.y < H + 12);
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    const p = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
    let blocked = false;
    for (const w of state.walls) if (collideRect(p, w)) blocked = true;
    if (blocked) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (b.slot === 0 || b.slot === 2) {
      if (collideRect(p, tankRect(state.player1))) {
        state.bullets.splice(i, 1);
        state.hearts1 = Math.max(0, state.hearts1 - 0.5);
        if (state.hearts1 <= 0) {
          state.over = true;
          if (state.gameMode === "duel") state.duelWinner = 2;
        }
        continue;
      }
    }
    if (b.slot === 1 && state.player2 && collideRect(p, tankRect(state.player2))) {
      state.bullets.splice(i, 1);
      state.hearts2 = Math.max(0, state.hearts2 - 0.5);
      if (state.hearts2 <= 0) {
        state.over = true;
        state.duelWinner = 1;
      }
      continue;
    }
    if (b.slot === 1 && state.gameMode === "campaign") {
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        if (collideRect(p, tankRect(state.enemies[j]))) {
          state.bullets.splice(i, 1);
          state.enemies.splice(j, 1);
          state.score += 250;
          state.streak += 1;
          break;
        }
      }
    }
  }
}

function drawTank(t, color) {
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.dir + Math.PI / 2);
  const s = t.size;
  ctx.fillStyle = "#5f6368";
  ctx.fillRect(-s * 0.45, -s * 0.74, s * 0.18, s * 1.48);
  ctx.fillRect(s * 0.27, -s * 0.74, s * 0.18, s * 1.48);
  ctx.fillStyle = color;
  ctx.fillRect(-s * 0.35, -s * 0.52, s * 0.7, s * 1.04);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(-s * 0.06, -s * 0.52, s * 0.12, s * 1.04);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-s * 0.18, -s * 0.24, s * 0.36, s * 0.48);
  ctx.fillStyle = "#222";
  ctx.fillRect(-s * 0.09, -s * 0.88, s * 0.18, s * 0.72);
  ctx.restore();
}
function drawBullet(b) {
  const a = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a);
  ctx.fillStyle = b.slot === 2 ? "#4fc3f7" : b.slot === 1 ? "#ffeb3b" : "#ff7043";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-2, -3);
  ctx.lineTo(-8, -2);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-8, 2);
  ctx.lineTo(-2, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.fillStyle = state.mapKind === "desert" ? "#c9a063" : "#46bf3c";
  ctx.fillRect(0, 0, W, H);
  for (const t of TUNNELS) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.dir + Math.PI / 2);
    ctx.fillStyle = "#171412";
    ctx.fillRect(-40, -20, 80, 40);
    ctx.restore();
  }
  ctx.fillStyle = "#787878";
  for (const w of state.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
  drawTank(state.player1, state.player1Color);
  if (state.player2) drawTank(state.player2, state.player2Color);
  for (const e of state.enemies) drawTank(e, e.color);
  for (const b of state.bullets) drawBullet(b);
  if (state.over) {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px Courier New";
    const txt = state.gameMode === "duel" ? `${state.duelWinner === 1 ? state.player1Name : state.player2Name} WINS` : "GAME OVER";
    ctx.fillText(txt, W / 2 - ctx.measureText(txt).width / 2, H / 2);
  }
}

function renderHud() {
  if (state.gameMode === "duel") {
    scoreTop.textContent = "1 vs 1";
    livesTop.textContent = `${state.player1Name} ${heartsLine(state.hearts1)} | ${state.player2Name} ${heartsLine(state.hearts2)}`;
    worldTop.textContent = "DUEL";
    bonusText.textContent = "—";
    streakText.textContent = "—";
    scoreSide.textContent = "—";
    heartsHud.innerHTML = `${state.player1Name}: ${heartsLine(state.hearts1)}<br>${state.player2Name}: ${heartsLine(state.hearts2)}`;
    ammoText.textContent = "∞ / ∞";
    p1Info.innerHTML = `${state.player1Name}: WASD + Space<br>${state.player2Name}: Arrows + Enter`;
  } else {
    scoreTop.textContent = `SCORE: ${state.score}`;
    livesTop.textContent = heartsLine(state.hearts1);
    worldTop.textContent = `WORLD ${state.world}-${state.stage}`;
    bonusText.textContent = "BONUS TIME: 0:45";
    streakText.textContent = `STREAK: ${state.streak}`;
    scoreSide.textContent = String(state.score);
    heartsHud.textContent = heartsLine(state.hearts1);
    ammoText.textContent = "∞";
    p1Info.innerHTML = `${state.player1Name}<br>SCORE: ${state.score}`;
  }
  enemyCountText.textContent = String(state.enemyCount);
  difficultyText.textContent = ["EASY", "NORMAL", "HARD"][state.diff - 1];
}

let lastTs = 0;
function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (!state.over && !state.paused) {
    updatePlayers(dt);
    updateEnemies(dt);
    updateBullets(dt);
  }
  render();
  renderHud();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "NumpadEnter", "KeyW", "KeyA", "KeyS", "KeyD", "KeyP"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyP" && !state.over) {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "RESUME" : "PAUSE";
  }
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

modeCampaignBtn.addEventListener("click", () => {
  modeCampaignBtn.classList.add("active");
  modeDuelBtn.classList.remove("active");
});
modeDuelBtn.addEventListener("click", () => {
  modeDuelBtn.classList.add("active");
  modeCampaignBtn.classList.remove("active");
});
mapGrassBtn.addEventListener("click", () => {
  mapGrassBtn.classList.add("active");
  mapDesertBtn.classList.remove("active");
});
mapDesertBtn.addEventListener("click", () => {
  mapDesertBtn.classList.add("active");
  mapGrassBtn.classList.remove("active");
});
restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", () => {
  if (state.over) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "RESUME" : "PAUSE";
});

function setHelpOpen(open) {
  helpModal.classList.toggle("hidden", !open);
  helpModal.setAttribute("aria-hidden", open ? "false" : "true");
}
helpBtn.addEventListener("click", () => setHelpOpen(true));
helpCloseBtn.addEventListener("click", () => setHelpOpen(false));
helpModal.addEventListener("click", (e) => {
  if (e.target === helpModal) setHelpOpen(false);
});

resetGame();
requestAnimationFrame(loop);
