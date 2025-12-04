const durations = {
  inhale: 4,
  hold: 2,
  exhale: 5,
};
const totalDuration = Object.values(durations).reduce((sum, val) => sum + val, 0);

const phaseLabels = {
  inhale: "Вдох",
  hold: "Пауза",
  exhale: "Выдох",
};

const phaseCoaching = {
  inhale: "Зажмите шар или пробел и позвольте грудной клетке раскрыться.",
  hold: "Сохраните плавность, чувствуйте расширение.",
  exhale: "Мягко отпустите — воздух выходит и тело расслабляется.",
};

const root = document.querySelector(".breath-404") ?? document.documentElement;
const orb = document.querySelector("[data-orb]");
const scoreEl = document.querySelector("[data-score]");
const bestEl = document.querySelector("[data-best]");
const streakEl = document.querySelector("[data-streak]");
const phaseEl = document.querySelector("[data-phase]");
const instructionEl = document.querySelector("[data-instruction]");
const progressEl = document.querySelector("[data-progress]");
const resetButton = document.querySelector("[data-reset]");
const homeButton = document.querySelector("[data-home]");

let cycleTime = 0;
let playerLevel = 0.3;
let isHolding = false;
let score = 0;
let bestScore = 0;
let streakTimer = 0;
let lastFrame = performance.now();

const pressHold = (event) => {
  if (event) {
    event.preventDefault();
  }
  isHolding = true;
  document.body.classList.add("is-holding");
};

const releaseHold = () => {
  isHolding = false;
  document.body.classList.remove("is-holding");
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const phaseFromTime = (time) => {
  let t = time % totalDuration;
  if (t < durations.inhale) {
    const fraction = t / durations.inhale;
    return {
      phase: "inhale",
      progress: fraction,
      targetLevel: fraction,
    };
  }

  t -= durations.inhale;
  if (t < durations.hold) {
    return {
      phase: "hold",
      progress: t / durations.hold,
      targetLevel: 1,
    };
  }

  t -= durations.hold;
  const fraction = t / durations.exhale;
  return {
    phase: "exhale",
    progress: fraction,
    targetLevel: 1 - fraction,
  };
};

const updateHud = (phase, targetLevel, dt) => {
  const inhaleSpeed = 1 / durations.inhale;
  const exhaleSpeed = 1 / durations.exhale;
  const direction = isHolding ? 1 : -1;
  const speed = direction > 0 ? inhaleSpeed : exhaleSpeed;
  playerLevel = clamp(playerLevel + direction * speed * dt);

  root.style.setProperty("--target-level", targetLevel.toFixed(3));
  root.style.setProperty("--player-level", playerLevel.toFixed(3));

  const accuracy = 1 - Math.abs(playerLevel - targetLevel);
  const calmGain = Math.max(0, accuracy) * dt * 20;
  score = Math.max(0, score + calmGain - dt * 0.5);
  bestScore = Math.max(bestScore, Math.round(score));

  if (accuracy > 0.85) {
    streakTimer += dt;
  } else {
    streakTimer = Math.max(0, streakTimer - dt * 0.6);
  }

  const calmSeries = Math.floor(streakTimer / 5);

  scoreEl.textContent = Math.round(score).toString();
  bestEl.textContent = bestScore.toString();
  streakEl.textContent = calmSeries.toString();
  phaseEl.textContent = phaseLabels[phase];
  instructionEl.textContent = phaseCoaching[phase];
};

const updateTimeline = () => {
  const progressPercent = `${((cycleTime % totalDuration) / totalDuration) * 100}%`;
  root.style.setProperty("--timeline-progress", progressPercent);
  progressEl.style.width = progressPercent;
};

const loop = (now) => {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  cycleTime = (cycleTime + dt) % totalDuration;
  const { phase, targetLevel } = phaseFromTime(cycleTime);

  updateHud(phase, targetLevel, dt);
  updateTimeline();

  requestAnimationFrame(loop);
};

const resetGame = () => {
  score = 0;
  streakTimer = 0;
  cycleTime = 0;
  playerLevel = 0.3;
  scoreEl.textContent = "0";
  streakEl.textContent = "0";
};

resetButton?.addEventListener("click", resetGame);
homeButton?.addEventListener("click", () => {
  window.location.href = "/";
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    if (!event.repeat) {
      pressHold(event);
    } else {
      event.preventDefault();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    releaseHold();
  }
});

orb?.addEventListener("pointerdown", pressHold);
window.addEventListener("pointerup", releaseHold);
window.addEventListener("pointercancel", releaseHold);
window.addEventListener("blur", releaseHold);

requestAnimationFrame((timestamp) => {
  lastFrame = timestamp;
  loop(timestamp);
});
