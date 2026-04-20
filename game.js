const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const SCORE_PER_LINES = [0, 100, 300, 500, 800];
const LEVEL_UP_EVERY = 10;

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

const COLORS = {
  I: "#00f5ff",
  O: "#ffd700",
  T: "#b468ff",
  S: "#43e97b",
  Z: "#ff5f6d",
  J: "#3f7cff",
  L: "#ff9f1c"
};

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next-piece");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const gameStateEl = document.getElementById("game-state");
const soundToggle = document.getElementById("sound-toggle");
const themeSelect = document.getElementById("theme-select");
const controlsToggle = document.getElementById("controls-toggle");
const controlsOverlay = document.getElementById("controls-overlay");
const controlsClose = document.getElementById("controls-close");

let board = [];
let currentPiece = null;
let nextPiece = null;
let dropAccumulator = 0;
let lastTime = 0;
let paused = false;
let gameOver = false;
let score = 0;
let clearedLines = 0;
let level = 1;
let audioCtx = null;
let soundEnabled = true;
let currentTheme = "dark";

function makeEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function createPiece(type = randomType()) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    color: COLORS[type],
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -1
  };
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}

function collides(piece, x = piece.x, y = piece.y, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) {
        continue;
      }
      const boardX = x + col;
      const boardY = y + row;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece(piece) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) {
        return;
      }
      const boardY = piece.y + rowIndex;
      if (boardY >= 0) {
        board[boardY][piece.x + colIndex] = piece.color;
      }
    });
  });
}

function clearFullRows() {
  let localCleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      localCleared += 1;
      y += 1;
    }
  }
  return localCleared;
}

function updateScore(lines) {
  if (lines === 0) {
    return;
  }
  score += SCORE_PER_LINES[lines] * level;
  clearedLines += lines;
  level = Math.floor(clearedLines / LEVEL_UP_EVERY) + 1;
  renderStats();
}

function renderCell(ctx, x, y, color, size) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x * size, y * size, size, size);
}

function drawBoard() {
  const canvasBg = getComputedStyle(document.body).getPropertyValue("--canvas-bg").trim() || "#090909";
  boardCtx.fillStyle = canvasBg;
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) {
        renderCell(boardCtx, x, y, cell, BLOCK_SIZE);
      }
    }
  }
}

function drawPiece(piece) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) {
        return;
      }
      const drawY = piece.y + rowIndex;
      if (drawY >= 0) {
        renderCell(boardCtx, piece.x + colIndex, drawY, piece.color, BLOCK_SIZE);
      }
    });
  });
}

function drawNextPiece() {
  const cellSize = 24;
  const canvasBg = getComputedStyle(document.body).getPropertyValue("--canvas-bg").trim() || "#090909";
  nextCtx.fillStyle = canvasBg;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) {
    return;
  }

  const width = nextPiece.matrix[0].length * cellSize;
  const height = nextPiece.matrix.length * cellSize;
  const offsetX = Math.floor((nextCanvas.width - width) / 2 / cellSize);
  const offsetY = Math.floor((nextCanvas.height - height) / 2 / cellSize);

  nextPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        renderCell(nextCtx, offsetX + colIndex, offsetY + rowIndex, nextPiece.color, cellSize);
      }
    });
  });
}

function renderStats() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(clearedLines);
  levelEl.textContent = String(level);
}

function renderGameState() {
  if (gameOver) {
    gameStateEl.textContent = "Игра окончена";
    gameStateEl.className = "pill over";
    pauseBtn.textContent = "Пауза";
    return;
  }

  if (paused) {
    gameStateEl.textContent = "На паузе";
    gameStateEl.className = "pill paused";
    pauseBtn.textContent = "Продолжить";
    return;
  }

  gameStateEl.textContent = "Идет игра";
  gameStateEl.className = "pill";
  pauseBtn.textContent = "Пауза";
}

function initAudio() {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
    }
  }
}

function ensureAudioReady() {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function playTone(freq, duration, type = "square", volume = 0.05) {
  if (!soundEnabled || !audioCtx) {
    return;
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playMoveSound() {
  playTone(240, 0.06, "square", 0.06);
}

function playRotateSound() {
  playTone(420, 0.09, "triangle", 0.07);
}

function playDropSound() {
  playTone(160, 0.1, "sawtooth", 0.08);
}

function playClearSound(lines) {
  const tones = [560, 660, 760, 900];
  const tone = tones[Math.min(lines, tones.length) - 1] || tones[0];
  playTone(tone, 0.15, "triangle", 0.08);
}

function playGameOverSound() {
  playTone(180, 0.22, "square", 0.09);
  setTimeout(() => playTone(140, 0.24, "square", 0.08), 110);
}

function getDropInterval() {
  return Math.max(100, 900 - (level - 1) * 70);
}

function spawnPiece() {
  currentPiece = nextPiece || createPiece();
  nextPiece = createPiece();
  drawNextPiece();

  if (collides(currentPiece)) {
    gameOver = true;
    startBtn.textContent = "Игра окончена - начать снова";
    playGameOverSound();
  }
  renderGameState();
}

function lockAndContinue() {
  mergePiece(currentPiece);
  const lines = clearFullRows();
  updateScore(lines);
  if (lines > 0) {
    playClearSound(lines);
  }
  spawnPiece();
}

function move(dx, dy) {
  const newX = currentPiece.x + dx;
  const newY = currentPiece.y + dy;
  if (!collides(currentPiece, newX, newY)) {
    currentPiece.x = newX;
    currentPiece.y = newY;
    return true;
  }
  return false;
}

function rotate() {
  const rotated = rotateMatrix(currentPiece.matrix);
  if (!collides(currentPiece, currentPiece.x, currentPiece.y, rotated)) {
    currentPiece.matrix = rotated;
    playRotateSound();
    return;
  }

  // Basic wall-kick to make rotation near edges playable.
  const kicks = [-1, 1, -2, 2];
  for (const offset of kicks) {
    if (!collides(currentPiece, currentPiece.x + offset, currentPiece.y, rotated)) {
      currentPiece.x += offset;
      currentPiece.matrix = rotated;
      playRotateSound();
      return;
    }
  }
}

function hardDrop() {
  while (move(0, 1)) {
    score += 2;
  }
  playDropSound();
  lockAndContinue();
  renderStats();
}

function tick(delta) {
  if (paused || gameOver) {
    return;
  }

  dropAccumulator += delta;
  if (dropAccumulator >= getDropInterval()) {
    dropAccumulator = 0;
    if (!move(0, 1)) {
      lockAndContinue();
    }
  }
}

function drawOverlay(text) {
  boardCtx.fillStyle = "rgba(0, 0, 0, 0.65)";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = "#ffffff";
  boardCtx.font = "bold 28px Arial";
  boardCtx.textAlign = "center";
  boardCtx.fillText(text, boardCanvas.width / 2, boardCanvas.height / 2);
}

function loop(timestamp = 0) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  tick(delta);
  drawBoard();

  if (!gameOver && currentPiece) {
    drawPiece(currentPiece);
  }

  if (paused && !gameOver) {
    drawOverlay("Пауза");
  }

  if (gameOver) {
    drawOverlay("Игра окончена");
  }

  requestAnimationFrame(loop);
}

function resetGame() {
  initAudio();
  board = makeEmptyBoard();
  currentPiece = null;
  nextPiece = null;
  paused = false;
  gameOver = false;
  dropAccumulator = 0;
  score = 0;
  clearedLines = 0;
  level = 1;
  renderStats();
  spawnPiece();
  startBtn.textContent = "Новая игра";
  renderGameState();
}

function togglePause() {
  if (gameOver) {
    return;
  }
  ensureAudioReady();
  paused = !paused;
  renderGameState();
}

function onKeyDown(event) {
  ensureAudioReady();

  if (event.code === "Escape" && !controlsOverlay.classList.contains("hidden")) {
    controlsOverlay.classList.add("hidden");
    controlsOverlay.setAttribute("aria-hidden", "true");
    controlsToggle.setAttribute("aria-expanded", "false");
    return;
  }

  if (!currentPiece) {
    return;
  }

  if (event.code === "KeyP" || event.code === "Escape") {
    togglePause();
    return;
  }

  if (paused || gameOver) {
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      if (move(-1, 0)) {
        playMoveSound();
      }
      break;
    case "ArrowRight":
      if (move(1, 0)) {
        playMoveSound();
      }
      break;
    case "ArrowDown":
      if (move(0, 1)) {
        score += 1;
        playMoveSound();
        renderStats();
      }
      break;
    case "ArrowUp":
      rotate();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
}

function restoreSoundState() {
  const saved = localStorage.getItem("tetris_sound_enabled");
  soundEnabled = saved === null ? true : saved === "true";
  soundToggle.checked = soundEnabled;
}

function applyTheme(theme) {
  const validTheme = theme === "light" ? "light" : "dark";
  currentTheme = validTheme;
  document.body.setAttribute("data-theme", validTheme);
  themeSelect.value = validTheme;
  localStorage.setItem("tetris_theme", validTheme);
}

function restoreThemeState() {
  const saved = localStorage.getItem("tetris_theme");
  applyTheme(saved || "dark");
}

function onThemeChange() {
  applyTheme(themeSelect.value);
}

function onSoundToggleChange() {
  ensureAudioReady();
  soundEnabled = soundToggle.checked;
  localStorage.setItem("tetris_sound_enabled", String(soundEnabled));
  if (soundEnabled) {
    playTone(520, 0.1, "triangle", 0.08);
  }
}

document.addEventListener("keydown", onKeyDown);
startBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", (event) => {
  event.preventDefault();
  togglePause();
});
soundToggle.addEventListener("change", onSoundToggleChange);
themeSelect.addEventListener("change", onThemeChange);
controlsToggle.addEventListener("click", () => {
  const isHidden = controlsOverlay.classList.toggle("hidden");
  controlsOverlay.setAttribute("aria-hidden", String(isHidden));
  controlsToggle.setAttribute("aria-expanded", String(!isHidden));
});
controlsClose.addEventListener("click", () => {
  controlsOverlay.classList.add("hidden");
  controlsOverlay.setAttribute("aria-hidden", "true");
  controlsToggle.setAttribute("aria-expanded", "false");
});
controlsOverlay.addEventListener("click", (event) => {
  if (event.target === controlsOverlay) {
    controlsOverlay.classList.add("hidden");
    controlsOverlay.setAttribute("aria-hidden", "true");
    controlsToggle.setAttribute("aria-expanded", "false");
  }
});

restoreThemeState();
restoreSoundState();
resetGame();
requestAnimationFrame(loop);
