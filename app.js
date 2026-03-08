const STORAGE_KEY = "taraweehCounterState-v1";
const HISTORY_KEY = "taraweehHistory-v1";
const GOAL = 20;
const TOTAL_RAMADAN_NIGHTS = 30;

const state = {
  rakats: 0,
  sessionStart: null,
  elapsedSeconds: 0,
  lastActiveDate: getDateKey(new Date()),
  mode: "taraweeh",
  dhikr: {
    subhanAllah: 0,
    alhamdulillah: 0,
    allahuAkbar: 0,
  },
};

const els = {
  rakatsCount: document.getElementById("rakatsCount"),
  setsCount: document.getElementById("setsCount"),
  elapsedTime: document.getElementById("elapsedTime"),
  ringProgress: document.getElementById("ringProgress"),
  progressText: document.getElementById("progressText"),
  completionMessage: document.getElementById("completionMessage"),
  tapCounter: document.getElementById("tapCounter"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  resetDialog: document.getElementById("resetDialog"),
  historyList: document.getElementById("historyList"),
  ramadanNight: document.getElementById("ramadanNight"),
  ramadanPct: document.getElementById("ramadanPct"),
  ramadanBar: document.getElementById("ramadanBar"),
  modeSwitch: document.getElementById("modeSwitch"),
  taraweehMode: document.getElementById("taraweehMode"),
  dhikrMode: document.getElementById("dhikrMode"),
  resetDhikr: document.getElementById("resetDhikr"),
  subhanAllahCount: document.getElementById("subhanAllahCount"),
  alhamdulillahCount: document.getElementById("alhamdulillahCount"),
  allahuAkbarCount: document.getElementById("allahuAkbarCount"),
  installBtn: document.getElementById("installBtn"),
};

const circumference = 2 * Math.PI * 52;
els.ringProgress.style.strokeDasharray = `${circumference}`;

let installPromptEvent;

loadState();
checkMidnightReset();
render();
startTicker();
renderHistory();
setupEvents();
registerPWA();

function setupEvents() {
  els.tapCounter.addEventListener("click", () => {
    checkMidnightReset();
    if (!state.sessionStart) {
      state.sessionStart = Date.now();
    }
    state.rakats = Math.min(GOAL, state.rakats + 2);
    addHaptic(18);
    animateCounter();
    persistAndRender();
  });

  els.undoBtn.addEventListener("click", () => {
    state.rakats = Math.max(0, state.rakats - 2);
    persistAndRender();
  });

  els.resetBtn.addEventListener("click", () => {
    if (typeof els.resetDialog.showModal === "function") {
      els.resetDialog.showModal();
    } else if (window.confirm("Reset current Taraweeh session?")) {
      resetCurrentSession();
    }
  });

  els.resetDialog?.addEventListener("close", () => {
    if (els.resetDialog.returnValue === "confirm") {
      resetCurrentSession();
    }
  });

  els.modeSwitch.addEventListener("change", () => {
    state.mode = els.modeSwitch.checked ? "dhikr" : "taraweeh";
    renderMode();
    saveState();
  });

  document.querySelectorAll(".dhikr-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.key;
      state.dhikr[key] += 1;
      addHaptic(10);
      saveState();
      renderDhikr();
    });
  });

  els.resetDhikr.addEventListener("click", () => {
    state.dhikr = { subhanAllah: 0, alhamdulillah: 0, allahuAkbar: 0 };
    saveState();
    renderDhikr();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPromptEvent = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener("click", async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    installPromptEvent = null;
    els.installBtn.hidden = true;
  });
}

function render() {
  const sets = state.rakats / 2;
  const progress = Math.min(state.rakats / GOAL, 1);

  els.rakatsCount.textContent = state.rakats;
  els.setsCount.textContent = sets;
  els.progressText.textContent = `${state.rakats} / ${GOAL}`;
  els.ringProgress.style.strokeDashoffset = `${circumference * (1 - progress)}`;
  els.completionMessage.textContent =
    state.rakats >= GOAL ? "Taraweeh Complete 🌙 May Allah accept it." : "";

  renderElapsedTime();
  renderRamadan();
  renderDhikr();
  renderMode();
}

function renderMode() {
  const dhikr = state.mode === "dhikr";
  els.modeSwitch.checked = dhikr;
  els.taraweehMode.classList.toggle("hidden", dhikr);
  els.dhikrMode.classList.toggle("hidden", !dhikr);
}

function renderDhikr() {
  els.subhanAllahCount.textContent = state.dhikr.subhanAllah;
  els.alhamdulillahCount.textContent = state.dhikr.alhamdulillah;
  els.allahuAkbarCount.textContent = state.dhikr.allahuAkbar;
}

function renderElapsedTime() {
  if (!state.sessionStart) {
    state.elapsedSeconds = 0;
    els.elapsedTime.textContent = "00:00:00";
    return;
  }
  state.elapsedSeconds = Math.floor((Date.now() - state.sessionStart) / 1000);
  els.elapsedTime.textContent = formatTime(state.elapsedSeconds);
}

function renderRamadan() {
  const night = getRamadanNight();
  const pct = Math.round((night / TOTAL_RAMADAN_NIGHTS) * 100);
  els.ramadanNight.textContent = `Ramadan Night: ${night} / ${TOTAL_RAMADAN_NIGHTS}`;
  els.ramadanPct.textContent = `${pct}%`;
  els.ramadanBar.style.width = `${pct}%`;
}

function startTicker() {
  setInterval(() => {
    checkMidnightReset();
    renderElapsedTime();
  }, 1000);
}

function resetCurrentSession() {
  if (state.rakats > 0 || state.sessionStart) {
    saveSessionToHistory();
  }
  state.rakats = 0;
  state.sessionStart = null;
  state.elapsedSeconds = 0;
  persistAndRender();
}

function saveSessionToHistory() {
  const history = getHistory();
  const night = getRamadanNight();
  history.unshift({
    night,
    rakats: state.rakats,
    duration: formatMinutes(state.elapsedSeconds),
    date: getDateKey(new Date()),
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  els.historyList.innerHTML = "";
  if (!history.length) {
    const li = document.createElement("li");
    li.textContent = "No previous sessions yet.";
    els.historyList.append(li);
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `Night ${entry.night} — ${entry.rakats} Rakats — ${entry.duration}`;
    els.historyList.append(li);
  });
}

function checkMidnightReset() {
  const todayKey = getDateKey(new Date());
  if (state.lastActiveDate !== todayKey) {
    if (state.rakats > 0 || state.sessionStart) {
      saveSessionToHistory();
    }
    state.rakats = 0;
    state.sessionStart = null;
    state.elapsedSeconds = 0;
    state.lastActiveDate = todayKey;
    saveState();
    render();
  }
}

function addHaptic(duration) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

function animateCounter() {
  els.tapCounter.classList.remove("bump");
  requestAnimationFrame(() => els.tapCounter.classList.add("bump"));
}

function persistAndRender() {
  state.lastActiveDate = getDateKey(new Date());
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getRamadanNight() {
  // Approximate Gregorian start dates (can be updated yearly).
  const startByYear = {
    2024: "2024-03-11",
    2025: "2025-03-01",
    2026: "2026-02-18",
    2027: "2027-02-08",
  };
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(startByYear[year] || `${year}-03-01`);
  const diffDays = Math.floor((now - start) / 86400000) + 1;
  return Math.min(TOTAL_RAMADAN_NIGHTS, Math.max(1, diffDays));
}

function formatTime(totalSeconds) {
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatMinutes(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} min`;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}
