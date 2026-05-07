// app.js — Pure16 Edition (czarny boot, power menu, pełne aplikacje)

// ─── Safe Storage ───
const SafeStorage = (() => {
  let mem = {};
  let useLS = false;
  try {
    localStorage.setItem("__t__", "1");
    localStorage.removeItem("__t__");
    useLS = true;
  } catch (_) {}
  return {
    get(k) {
      try {
        return useLS ? localStorage.getItem(k) : mem[k] ?? null;
      } catch (_) {
        return mem[k] ?? null;
      }
    },
    set(k, v) {
      try {
        if (useLS) localStorage.setItem(k, v);
      } catch (_) {}
      mem[k] = v;
    },
    remove(k) {
      try {
        if (useLS) localStorage.removeItem(k);
      } catch (_) {}
      delete mem[k];
    },
  };
})();

// ─── OTA (z Twojej wersji) ───
const OTA = (() => {
  const REPO = "luterekluter/apkasystem";
  const VER = "1.0.0";

  function semverGt(a, b) {
    try {
      const pa = a.replace(/^v/, "").split(".").map(Number);
      const pb = b.replace(/^v/, "").split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return true;
        if ((pa[i] || 0) < (pb[i] || 0)) return false;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async function fetchText(u) {
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    return r.text();
  }

  async function check() {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${REPO}/releases/latest`,
        { cache: "no-store" }
      );
      if (!r.ok) return;
      const d = await r.json();
      const tag = (d.tag_name || "").replace(/^v/, "");
      if (!semverGt(tag, VER)) return;
      const base = `https://raw.githubusercontent.com/${REPO}/main/web`;
      const [js, css] = await Promise.all([
        fetchText(`${base}/app.js`),
        fetchText(`${base}/styles.css`),
      ]);
      SafeStorage.set("ota_js", js);
      SafeStorage.set("ota_css", css);
      SafeStorage.set("ota_ver", tag);
      location.reload();
    } catch (_) {}
  }

  function applyStored() {
    try {
      const css = SafeStorage.get("ota_css"),
        js = SafeStorage.get("ota_js");
      if (css) {
        let el = document.getElementById("ota-s");
        if (!el) {
          el = document.createElement("style");
          el.id = "ota-s";
          document.head.appendChild(el);
        }
        el.textContent = css;
      }
      if (js) {
        new Function(js)();
        return true;
      }
    } catch (_) {
      try {
        SafeStorage.remove("ota_js");
      } catch (_2) {}
    }
    return false;
  }

  return { check, applyStored };
})();

// ─── State ───
const ONBOARDING_KEY = "pure16_onboarding_done";
const NOTES_KEY = "pure16_notes";

const state = {
  mode: "boot", // 'boot' | 'oobe' | 'home' | 'app' | 'off'
  oobeIndex: 0,
  oobeDirection: "forward",
  activeApp: null, // 'calc' | 'notes' | 'weather'
  powerMenuOpen: false,
  bootTarget: "home",
  lastClockTap: 0,
};

let clockInterval = null;

// ─── OOBE steps (bez Pomiń, tylko Dalej/Zakończ) ───
const OOBE_STEPS = [
  {
    id: "welcome",
    eyebrow: "Pure16",
    title: "Witaj",
    subtitle: "Skonfigurujmy Twój nowy telefon. To zajmie tylko chwilę.",
    body: () => `
      <ul class="oobe-list">
        <li>Ustawimy podstawowe rzeczy, jak język, strefę czasową i połączenie.</li>
        <li>W każdej chwili możesz później zmienić te ustawienia.</li>
      </ul>
    `,
  },
  {
    id: "network",
    eyebrow: "Sieć",
    title: "Połączenie z internetem",
    subtitle: "Zadbaj o to, aby Pure16 miało łączność.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Tryb połączenia</div>
        <div class="oobe-input-row">
          <button class="oobe-input" data-oobe-choice="wifi">Wi‑Fi</button>
          <button class="oobe-input" data-oobe-choice="lte">LTE/5G</button>
        </div>
      </div>
      <ul class="oobe-list">
        <li>Połączenie jest wymagane do synchronizacji czasu i pogody.</li>
      </ul>
    `,
  },
  {
    id: "privacy",
    eyebrow: "Konto",
    title: "Twoje dane",
    subtitle: "Zapisujemy tylko minimum w pamięci urządzenia.",
    body: () => `
      <ul class="oobe-list">
        <li>Notatki, ustawienia i stan aplikacji są przechowywane lokalnie.</li>
        <li>Możesz je w każdej chwili usunąć z poziomu ustawień systemu.</li>
      </ul>
    `,
  },
];

// ─── Helpers ───
function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
}

function formatTime(date = new Date()) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Notes storage ───
function loadNotes() {
  try {
    const raw = SafeStorage.get(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  return [];
}

function saveNotes(notes) {
  try {
    SafeStorage.set(NOTES_KEY, JSON.stringify(notes));
  } catch (_) {}
}

// ─── Mode transitions ───
function startBoot(target = "home") {
  state.mode = "boot";
  state.bootTarget = target;
  state.powerMenuOpen = false;
  render();
  vibrate([15, 60, 40, 40]);
  setTimeout(() => {
    if (state.mode !== "boot") return;
    const done = !!SafeStorage.get(ONBOARDING_KEY);
    if (!done) {
      state.mode = "oobe";
      state.oobeIndex = 0;
    } else {
      state.mode = target === "home" ? "home" : target;
    }
    render();
  }, 2200);
}

function goOff() {
  state.mode = "off";
  state.powerMenuOpen = false;
  render();
}

function goHome() {
  state.mode = "home";
  state.activeApp = null;
  state.powerMenuOpen = false;
  render();
}

function goApp(appId) {
  state.mode = "app";
  state.activeApp = appId;
  state.powerMenuOpen = false;
  render();
  if (appId === "weather") {
    initWeather();
  }
}

function completeOOBE() {
  SafeStorage.set(ONBOARDING_KEY, "1");
  goHome();
}

function togglePowerMenu(open) {
  state.powerMenuOpen = open ?? !state.powerMenuOpen;
  render();
}

// ─── OOBE navigation (bez skipa) ───
function nextOOBE() {
  const last = OOBE_STEPS.length - 1;
  if (state.oobeIndex < last) {
    state.oobeDirection = "forward";
    state.oobeIndex++;
    render();
  } else {
    completeOOBE();
  }
}

// ─── Weather (prosty fetch Open-Meteo, kilka miast) ───
const WEATHER_CITIES = {
  warszawa: { name: "Warszawa", lat: 52.23, lon: 21.01 },
  krakow: { name: "Kraków", lat: 50.06, lon: 19.94 },
  gdansk: { name: "Gdańsk", lat: 54.37, lon: 18.62 },
};

let currentWeatherCity = "warszawa";

async function fetchWeather(cityKey) {
  const c = WEATHER_CITIES[cityKey];
  if (!c) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&timezone=auto`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("weather");
  const data = await resp.json();
  return {
    city: c.name,
    temp: Math.round(data.current.temperature_2m),
    code: data.current.weather_code,
  };
}

function weatherDescription(code) {
  if (code === 0) return "Bezchmurnie";
  if (code >= 1 && code <= 3) return "Częściowe zachmurzenie";
  if (code >= 45 && code <= 48) return "Mgła";
  if (code >= 51 && code <= 67) return "Mżawka / deszcz";
  if (code >= 71 && code <= 77) return "Śnieg";
  if (code >= 80 && code <= 82) return "Przelotny deszcz";
  if (code >= 95) return "Burza";
  return "Pogoda nieznana";
}

function initWeather() {
  const statusEl = document.querySelector(".weather-status");
  if (!statusEl) return;
  statusEl.textContent = "Ładowanie pogody…";
  loadWeather(currentWeatherCity);
}

function loadWeather(cityKey) {
  const statusEl = document.querySelector(".weather-status");
  const tempEl = document.querySelector(".weather-main-temp");
  const cityEl = document.querySelector(".weather-city");
  if (!statusEl || !tempEl || !cityEl) return;

  currentWeatherCity = cityKey;
  document
    .querySelectorAll(".weather-city-btn")
    .forEach((btn) =>
      btn.dataset.city === cityKey
        ? btn.classList.add("active")
        : btn.classList.remove("active")
    );

  statusEl.textContent = "Ładowanie…";
  fetchWeather(cityKey)
    .then((w) => {
      if (!w) throw new Error();
      tempEl.textContent = `${w.temp}°`;
      cityEl.textContent = w.city;
      statusEl.textContent = weatherDescription(w.code);
    })
    .catch(() => {
      statusEl.textContent = "Brak danych (offline?)";
    });
}

// ─── Clock ───
function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  const applyTime = () => {
    const time = formatTime();
    const bar = document.querySelector(".status-bar-clock");
    const home = document.querySelector(".home-time");
    if (bar) bar.textContent = time;
    if (home) home.textContent = time;
    const dateEl = document.querySelector(".home-date");
    if (dateEl) dateEl.textContent = formatDate();
  };
  applyTime();
  clockInterval = setInterval(applyTime, 1000);
}

// ─── Android bridge helpers ───
function openSettingsFromBridge() {
  if (window.AndroidBridge && typeof AndroidBridge.openSettings === "function") {
    try {
      AndroidBridge.openSettings();
      return;
    } catch (_) {}
  }
  alert("Ustawienia dostępne w wersji Android (AndroidBridge).");
}

// ─── SVG ICONS ───
function svgCalc() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="4" fill="#111" />
      <rect x="6.5" y="5.5" width="11" height="4" rx="1.2" fill="#2c2c2e" />
      <circle cx="8" cy="12.5" r="1.3" fill="#e5e5ea" />
      <circle cx="12" cy="12.5" r="1.3" fill="#e5e5ea" />
      <circle cx="16" cy="12.5" r="1.3" fill="#e5e5ea" />
      <rect x="7" y="15.5" width="10" height="3" rx="1.2" fill="#007aff" />
    </svg>
  `;
}

function svgNotes() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="4" fill="#fff9e6" />
      <rect x="7" y="7" width="10" height="1.6" rx="0.8" fill="#ffcc00" />
      <rect x="7" y="11" width="7" height="1.6" rx="0.8" fill="#c7c7cc" />
      <rect x="7" y="15" width="5" height="1.6" rx="0.8" fill="#c7c7cc" />
      <path d="M16 16.5 L17.8 18.3" stroke="#ff9500" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="15" cy="15.5" r="1.1" fill="#ff9500"/>
    </svg>
  `;
}

function svgWeather() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="4" fill="#ffcc00" />
      <path d="M5 18h11a3 3 0 0 0 0-6 4 4 0 0 0-7.5-1.5" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function svgPhone() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="3" fill="#0b84ff" />
      <rect x="10" y="5" width="4" height="1" rx="0.5" fill="#e5f2ff" />
      <circle cx="12" cy="18" r="1" fill="#e5f2ff" />
    </svg>
  `;
}

function svgBrowser() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="#ffffff" stroke="#007aff" stroke-width="1.4"/>
      <path d="M7 12h10M12 7v10" stroke="#007aff" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#c7c7cc" stroke-width="1.1"/>
    </svg>
  `;
}

function svgCamera() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6.5" width="16" height="11" rx="3" fill="#1c1c1e" />
      <rect x="7" y="4" width="5" height="3" rx="1" fill="#2c2c2e" />
      <circle cx="12" cy="12" r="3.2" fill="#0b84ff" />
      <circle cx="12" cy="12" r="1.4" fill="#ffffff" />
    </svg>
  `;
}

// ─── RENDER ───
function renderStatusBar() {
  return `
    <div class="status-bar">
      <div class="status-bar-left">
        <span class="sb-carrier">PURE</span>
        <div class="sb-icon-signal">
          <svg viewBox="0 0 24 24">
            <rect x="4" y="14" width="2" height="6" fill="#1c1c1e"/>
            <rect x="8" y="12" width="2" height="8" fill="#1c1c1e"/>
            <rect x="12" y="10" width="2" height="10" fill="#1c1c1e"/>
            <rect x="16" y="8" width="2" height="12" fill="#1c1c1e"/>
          </svg>
        </div>
        <div class="sb-icon-wifi">
          <svg viewBox="0 0 24 24">
            <path d="M4 10c2.2-2 4.6-3 8-3s5.8 1 8 3" fill="none" stroke="#1c1c1e" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M7 13c1.4-1.3 3-2 5-2s3.6.7 5 2" fill="none" stroke="#1c1c1e" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M10 16c.6-.6 1.2-.9 2-.9s1.4.3 2 .9" fill="none" stroke="#1c1c1e" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="12" cy="18.2" r="1.1" fill="#1c1c1e"/>
          </svg>
        </div>
      </div>
      <div class="status-bar-clock"></div>
      <div class="status-bar-clock-hit" data-clock-hit></div>
      <div class="status-bar-right">
        <div class="sb-battery">
          <div class="sb-battery-body"><div class="sb-battery-fill"></div></div>
          <span class="sb-battery-percent">73%</span>
        </div>
        <button class="sb-power" type="button" data-open-power>
          <svg viewBox="0 0 24 24">
            <path d="M12 4v6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
            <path d="M8.2 6.5A6.5 6.5 0 1 0 17 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function renderBoot() {
  return `
    <div class="boot-screen">
      <div class="boot-logo"><span>PURE</span></div>
      <div class="boot-tagline">Minimalistyczny launcher systemowy Pure16.</div>
      <div class="boot-progress">
        <div class="boot-progress-fill"></div>
      </div>
      <div class="boot-device">ANDROID 16 · CLEAN</div>
    </div>
  `;
}

function renderOff() {
  return `
    <div class="off-screen">
      <div class="off-logo">PURE</div>
      <div>Urządzenie jest wyłączone.</div>
      <button class="off-hint-btn" type="button" data-off-power-on>
        Włącz
      </button>
    </div>
  `;
}

function renderOOBE() {
  const step = OOBE_STEPS[state.oobeIndex];
  const total = OOBE_STEPS.length;
  const dots = Array.from({ length: total })
    .map(
      (_, i) =>
        `<div class="oobe-dot ${i === state.oobeIndex ? "active" : ""}"></div>`
    )
    .join("");
  const animClass =
    state.oobeDirection === "forward"
      ? "slide-in-forward"
      : "slide-in-backward";

  const btnLabel =
    state.oobeIndex === total - 1 ? "Zakończ konfigurację" : "Dalej";

  return `
    <div class="oobe-container">
      <div class="oobe-screen ${animClass}">
        <div>
          <div class="oobe-header-eyebrow">${step.eyebrow}</div>
          <div class="oobe-title">${step.title}</div>
          <div class="oobe-subtitle">${step.subtitle}</div>
          <div class="oobe-body">
            ${step.body()}
          </div>
        </div>
        <div class="oobe-footer">
          <div class="oobe-progress-dots">${dots}</div>
          <button class="oobe-next-btn" type="button" data-oobe-next>
            ${btnLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderHome() {
  return `
    <div class="home-screen">
      <div class="home-top">
        <div class="home-time"></div>
        <div class="home-date"></div>
      </div>
      <div class="apps-grid">
        <div class="app-tile" data-open-app="calc">
          <div class="app-icon">${svgCalc()}</div>
          <div class="app-label">Kalkulator</div>
        </div>
        <div class="app-tile" data-open-app="notes">
          <div class="app-icon">${svgNotes()}</div>
          <div class="app-label">Notatki</div>
        </div>
        <div class="app-tile" data-open-app="weather">
          <div class="app-icon">${svgWeather()}</div>
          <div class="app-label">Pogoda</div>
        </div>
      </div>
      <div class="dock">
        <div class="app-tile" data-open-external="phone">
          <div class="app-icon">${svgPhone()}</div>
          <div class="app-label">Telefon</div>
        </div>
        <div class="app-tile" data-open-external="browser">
          <div class="app-icon">${svgBrowser()}</div>
          <div class="app-label">Przeglądarka</div>
        </div>
        <div class="app-tile" data-open-external="camera">
          <div class="app-icon">${svgCamera()}</div>
          <div class="app-label">Aparat</div>
        </div>
      </div>
    </div>
  `;
}

function renderCalcApp() {
  return `
    <div class="app-view">
      <div class="app-header">
        <button class="app-back" type="button" data-back-home>‹</button>
        <div class="app-title">Kalkulator</div>
      </div>
      <div class="app-body">
        <div class="calc-root" data-calc-root>
          <div class="calc-display">
            <div class="calc-display-main" data-calc-main>0</div>
            <div class="calc-display-sub" data-calc-sub></div>
          </div>
          <div class="calc-keys">
            <button class="calc-key func" data-calc-key="C">C</button>
            <button class="calc-key func" data-calc-key="±">±</button>
            <button class="calc-key func" data-calc-key="%">%</button>
            <button class="calc-key op" data-calc-key="/">÷</button>

            <button class="calc-key" data-calc-key="7">7</button>
            <button class="calc-key" data-calc-key="8">8</button>
            <button class="calc-key" data-calc-key="9">9</button>
            <button class="calc-key op" data-calc-key="*">×</button>

            <button class="calc-key" data-calc-key="4">4</button>
            <button class="calc-key" data-calc-key="5">5</button>
            <button class="calc-key" data-calc-key="6">6</button>
            <button class="calc-key op" data-calc-key="-">−</button>

            <button class="calc-key" data-calc-key="1">1</button>
            <button class="calc-key" data-calc-key="2">2</button>
            <button class="calc-key" data-calc-key="3">3</button>
            <button class="calc-key op" data-calc-key="+">+</button>

            <button class="calc-key" data-calc-key="0" style="grid-column: span 2;">0</button>
            <button class="calc-key" data-calc-key=".">,</button>
            <button class="calc-key op" data-calc-key="=">=</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderNotesApp() {
  const notes = loadNotes();
  const items = notes
    .map(
      (n, idx) => `
      <div class="note-item">
        <div class="note-item-title">${n.title || "Bez tytułu"}</div>
        <button class="note-item-delete" type="button" data-note-delete="${idx}">Usuń</button>
      </div>
    `
    )
    .join("");

  return `
    <div class="app-view">
      <div class="app-header">
        <button class="app-back" type="button" data-back-home>‹</button>
        <div class="app-title">Notatki</div>
      </div>
      <div class="app-body">
        <div class="notes-root">
          <div class="notes-list">
            ${items || '<div style="font-size:12px; color:#8e8e93;">Brak notatek.</div>'}
          </div>
          <div class="notes-editor">
            <input class="notes-title-input" data-note-title placeholder="Tytuł" />
            <textarea class="notes-body-input" data-note-body placeholder="Treść notatki"></textarea>
            <button class="notes-save-btn" type="button" data-note-save>Zapisz</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderWeatherApp() {
  return `
    <div class="app-view">
      <div class="app-header">
        <button class="app-back" type="button" data-back-home>‹</button>
        <div class="app-title">Pogoda</div>
      </div>
      <div class="app-body">
        <div class="weather-root">
          <div class="weather-card">
            <div class="weather-main-temp">--°</div>
            <div class="weather-city">Miasto</div>
            <div class="weather-status">Ładowanie…</div>
            <div class="weather-footer">Dane z Open‑Meteo</div>
          </div>
          <div class="weather-actions">
            <button class="weather-city-btn" data-city="warszawa">Warszawa</button>
            <button class="weather-city-btn" data-city="krakow">Kraków</button>
            <button class="weather-city-btn" data-city="gdansk">Gdańsk</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPowerOverlay() {
  if (!state.powerMenuOpen) return "";
  return `
    <div class="power-overlay">
      <div class="power-menu">
        <div class="power-title">Zasilanie</div>
        <div class="power-buttons">
          <button class="power-btn off" type="button" data-power="off">Wyłącz</button>
          <button class="power-btn on" type="button" data-power="on">Włącz</button>
          <button class="power-btn restart" type="button" data-power="restart">Restart</button>
        </div>
        <button class="power-cancel" type="button" data-power="cancel">Anuluj</button>
      </div>
    </div>
  `;
}

function renderRoot() {
  const app = document.getElementById("app");
  if (!app) return;

  let content = "";
  if (state.mode === "boot") {
    content = renderBoot();
  } else if (state.mode === "off") {
    content = renderOff();
  } else if (state.mode === "oobe") {
    content = renderOOBE();
  } else if (state.mode === "home") {
    content = renderHome();
  } else if (state.mode === "app") {
    if (state.activeApp === "calc") content = renderCalcApp();
    else if (state.activeApp === "notes") content = renderNotesApp();
    else if (state.activeApp === "weather") content = renderWeatherApp();
    else content = renderHome();
  }

  app.innerHTML = `
    <div class="app-root">
      ${renderStatusBar()}
      <div class="main-screen">
        ${content}
      </div>
      ${renderPowerOverlay()}
    </div>
  `;

  startClock();
  attachHandlers();
}

// ─── Handlers ───
function attachHandlers() {
  // Zegar → ustawienia
  const clockHit = document.querySelector("[data-clock-hit]");
  if (clockHit) {
    clockHit.onclick = () => {
      openSettingsFromBridge();
    };
  }

  // Power menu
  const openPower = document.querySelector("[data-open-power]");
  if (openPower) {
    openPower.onclick = () => togglePowerMenu(true);
  }

  document
    .querySelectorAll("[data-power]")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-power");
        if (action === "off") {
          vibrate([40, 80, 80]);
          goOff();
        } else if (action === "on") {
          vibrate([15, 40, 15]);
          startBoot("home");
        } else if (action === "restart") {
          vibrate([25, 40, 25]);
          startBoot("home");
        } else if (action === "cancel") {
          togglePowerMenu(false);
        }
      })
    );

  const offBtn = document.querySelector("[data-off-power-on]");
  if (offBtn) {
    offBtn.onclick = () => {
      startBoot("home");
    };
  }

  // OOBE
  const nextBtn = document.querySelector("[data-oobe-next]");
  if (nextBtn) {
    nextBtn.onclick = () => {
      nextOOBE();
    };
  }

  document.querySelectorAll("[data-oobe-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-oobe-choice]")
        .forEach((b) => b.classList.remove("oobe-choice-active"));
      btn.classList.add("oobe-choice-active");
    });
  });

  // Home → apps
  document.querySelectorAll("[data-open-app]").forEach((el) => {
    el.addEventListener("click", () => {
      const appId = el.getAttribute("data-open-app");
      goApp(appId);
    });
  });

  // External (telefon, przeglądarka, aparat)
  document.querySelectorAll("[data-open-external]").forEach((el) => {
    el.addEventListener("click", () => {
      const type = el.getAttribute("data-open-external");
      if (!window.AndroidBridge) {
        alert("Wersja web nie ma dostępu do natywnych aplikacji.");
        return;
      }
      try {
        if (type === "phone" && AndroidBridge.openPhone)
          AndroidBridge.openPhone();
        else if (type === "browser" && AndroidBridge.openBrowser)
          AndroidBridge.openBrowser();
        else if (type === "camera" && AndroidBridge.openCamera)
          AndroidBridge.openCamera();
      } catch (_) {}
    });
  });

  // Back z aplikacji
  document.querySelectorAll("[data-back-home]").forEach((btn) => {
    btn.addEventListener("click", () => {
      goHome();
    });
  });

  // Kalkulator
  const calcRoot = document.querySelector("[data-calc-root]");
  if (calcRoot) {
    initCalc(calcRoot);
  }

  // Notatki
  const noteSave = document.querySelector("[data-note-save]");
  if (noteSave) {
    noteSave.addEventListener("click", () => {
      const title = document.querySelector("[data-note-title]").value.trim();
      const body = document.querySelector("[data-note-body]").value.trim();
      if (!body && !title) return;
      const notes = loadNotes();
      notes.unshift({
        title: title || body.slice(0, 20),
        body,
        createdAt: Date.now(),
      });
      saveNotes(notes);
      goApp("notes");
    });
  }

  document.querySelectorAll("[data-note-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-note-delete"), 10);
      const notes = loadNotes();
      if (idx >= 0 && idx < notes.length) {
        notes.splice(idx, 1);
        saveNotes(notes);
        goApp("notes");
      }
    });
  });

  // Pogoda – wybór miasta
  document.querySelectorAll(".weather-city-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const city = btn.getAttribute("data-city");
      loadWeather(city);
    });
  });
}

// ─── Calculator logic ───
function initCalc(root) {
  const mainEl = root.querySelector("[data-calc-main]");
  const subEl = root.querySelector("[data-calc-sub]");

  const calcState = {
    current: "0",
    operand: null,
    operator: null,
    justEvaluated: false,
  };

  function updateDisplay() {
    mainEl.textContent = calcState.current;
    if (calcState.operator && calcState.operand != null) {
      subEl.textContent = `${calcState.operand} ${calcState.operator}`;
    } else {
      subEl.textContent = "";
    }
  }

  function inputDigit(d) {
    if (calcState.justEvaluated) {
      calcState.current = d;
      calcState.justEvaluated = false;
      return;
    }
    if (calcState.current === "0") calcState.current = d;
    else calcState.current += d;
  }

  function inputDot() {
    if (calcState.justEvaluated) {
      calcState.current = "0.";
      calcState.justEvaluated = false;
      return;
    }
    if (!calcState.current.includes(".")) {
      calcState.current += ".";
    }
  }

  function clearAll() {
    calcState.current = "0";
    calcState.operand = null;
    calcState.operator = null;
    calcState.justEvaluated = false;
  }

  function toggleSign() {
    if (calcState.current.startsWith("-"))
      calcState.current = calcState.current.slice(1);
    else if (calcState.current !== "0")
      calcState.current = "-" + calcState.current;
  }

  function percent() {
    const val = parseFloat(calcState.current);
    if (isNaN(val)) return;
    calcState.current = String(val / 100);
  }

  function applyOperator(op) {
    const val = parseFloat(calcState.current);
    if (isNaN(val)) return;
    if (calcState.operand == null || calcState.justEvaluated) {
      calcState.operand = val;
    } else if (calcState.operator) {
      const result = compute(calcState.operand, val, calcState.operator);
      calcState.operand = result;
      calcState.current = String(result);
    }
    calcState.operator = op;
    calcState.current = "0";
    calcState.justEvaluated = false;
  }

  function compute(a, b, op) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b === 0 ? 0 : a / b;
    return b;
  }

  function evaluate() {
    const val = parseFloat(calcState.current);
    if (isNaN(val)) return;
    if (calcState.operand == null || !calcState.operator) return;
    const result = compute(calcState.operand, val, calcState.operator);
    calcState.current = String(result);
    calcState.operand = null;
    calcState.operator = null;
    calcState.justEvaluated = true;
  }

  root.querySelectorAll("[data-calc-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-calc-key");
      if (key === "C") {
        clearAll();
      } else if (key === "±") {
        toggleSign();
      } else if (key === "%") {
        percent();
      } else if (key === ".") {
        inputDot();
      } else if (["+", "-", "*", "/"].includes(key)) {
        applyOperator(key);
      } else if (key === "=") {
        evaluate();
      } else if (/^\d$/.test(key)) {
        inputDigit(key);
      }
      updateDisplay();
    });
  });

  updateDisplay();
}

// ─── Init ───
(function init() {
  if (OTA.applyStored()) {
    return;
  }
  document.addEventListener("DOMContentLoaded", () => {
    OTA.check();
    startBoot("home");
    renderRoot();
  });
})();

// ensure render after state change
function render() {
  renderRoot();
}
