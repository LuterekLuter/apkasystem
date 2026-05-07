// app.js — Pure16 Edition
// White / iOS-inspired UI

// ─── Safe Storage ───
const SafeStorage = (() => {
  let mem = {};
  let useLS = false;
  try { localStorage.setItem("__t__","1"); localStorage.removeItem("__t__"); useLS = true; } catch(_) {}
  return {
    get(k)    { try { return useLS ? localStorage.getItem(k) : (mem[k] ?? null); } catch(_) { return mem[k] ?? null; } },
    set(k, v) { try { if (useLS) localStorage.setItem(k, v); } catch(_) {} mem[k] = v; },
    remove(k) { try { if (useLS) localStorage.removeItem(k); } catch(_) {} delete mem[k]; }
  };
})();

// ─── OTA ───
const OTA = (() => {
  const REPO = "luterekluter/apkasystem";
  const VER  = "1.0.0";
  function semverGt(a,b) {
    try {
      const pa = a.replace(/^v/,"").split(".").map(Number);
      const pb = b.replace(/^v/,"").split(".").map(Number);
      for (let i=0;i<3;i++) { if ((pa[i]||0)>(pb[i]||0)) return true; if ((pa[i]||0)<(pb[i]||0)) return false; }
      return false;
    } catch(_) { return false; }
  }
  async function fetchText(u) { const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw new Error(r.status); return r.text(); }
  async function check() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{cache:"no-store"});
      if (!r.ok) return;
      const d = await r.json();
      const tag = (d.tag_name||"").replace(/^v/,"");
      if (!semverGt(tag,VER)) return;
      const base = `https://raw.githubusercontent.com/${REPO}/main/web`;
      const [js,css] = await Promise.all([fetchText(`${base}/app.js`),fetchText(`${base}/styles.css`)]);
      SafeStorage.set("ota_js",js); SafeStorage.set("ota_css",css); SafeStorage.set("ota_ver",tag);
      location.reload();
    } catch(_) {}
  }
  function applyStored() {
    try {
      const css=SafeStorage.get("ota_css"), js=SafeStorage.get("ota_js");
      if (css) { let el=document.getElementById("ota-s"); if(!el){el=document.createElement("style");el.id="ota-s";document.head.appendChild(el);} el.textContent=css; }
      if (js) { (new Function(js))(); return true; }
    } catch(_) { try { SafeStorage.remove("ota_js"); } catch(_2) {} }
    return false;
  }
  return { check, applyStored };
})();

// ─── State ───
const ONBOARDING_KEY = "pure16_onboarding_done";

const state = {
  mode: "boot",
  stepIndex: 0,
  lastClockTap: 0,
  bootNextMode: "oobe",
  bootTimeoutSet: false,
  clockInterval: null,
};

// ─── OOBE Steps ───
const OOBE_STEPS = [
  {
    id: "welcome",
    eyebrow: "Pure16",
    title: "Witaj",
    subtitle: "Skonfigurujmy Twój nowy telefon. To zajmie tylko chwilę.",
    body: () => `
      <ul class="oobe-list">
        <li>Wybierzesz język i region</li>
        <li>Połączysz się z Wi‑Fi</li>
        <li>Ustawisz konto i zabezpieczenia</li>
        <li>Zadbasz o prywatność</li>
      </ul>
    `,
  },
  {
    id: "language",
    eyebrow: "Krok 1 z 9",
    title: "Język i region",
    subtitle: "Dostosuj Pure16 do swojego języka.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Język systemu</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">Polski (Polska)</span><span class="oobe-segment-badge">Wybrano</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">English (US)</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">Deutsch</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">Français</span></div>
        </div>
        <div class="oobe-field-label" style="margin-top:4px">Region</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">Polska</span><span class="oobe-segment-badge">Auto</span></div>
        </div>
      </div>
    `,
  },
  {
    id: "datetime",
    eyebrow: "Krok 2 z 9",
    title: "Data i godzina",
    subtitle: "Upewnij się, że czas jest ustawiony poprawnie.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Automatyczna data i godzina</div><div>Synchronizacja przez sieć</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
        <div class="oobe-field-label">Lub ustaw ręcznie</div>
        <div class="oobe-input-row">
          <input class="oobe-input" type="date" />
          <input class="oobe-input" type="time" />
        </div>
      </div>
    `,
  },
  {
    id: "wifi",
    eyebrow: "Krok 3 z 9",
    title: "Sieć Wi‑Fi",
    subtitle: "Połącz się, aby aktywować telefon i pobrać aktualizacje.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Dostępne sieci</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">Dom_5G</span><span>▲ Silny sygnał</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">Dom_2.4G</span><span>▲ Średni</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">Hotspot telefonu</span><span>▲ Słaby</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">+ Dodaj sieć</span></div>
        </div>
      </div>
    `,
  },
  {
    id: "transfer",
    eyebrow: "Krok 4 z 9",
    title: "Przenieś dane",
    subtitle: "Skopiuj swoje aplikacje, zdjęcia i kontakty ze starego telefonu.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">📱 Z telefonu z Androidem</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">☁️ Z kopii zapasowej w chmurze</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">🍎 Z iPhone'a</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">✨ Zacznij od nowa</span></div>
        </div>
      </div>
    `,
  },
  {
    id: "google",
    eyebrow: "Krok 5 z 9",
    title: "Konto Google",
    subtitle: "Zaloguj się, by zsynchronizować aplikacje i dane.",
    body: () => `
      <div class="oobe-field-group">
        <input class="oobe-input" type="email" placeholder="Adres e‑mail lub telefon" autocomplete="off" />
        <input class="oobe-input" type="password" placeholder="Hasło" autocomplete="off" />
        <div class="oobe-field-label">Możesz pominąć i dodać konto później w Ustawieniach.</div>
        <div class="oobe-toggle-row" style="margin-top:4px">
          <div><div class="oobe-toggle-label-main">Usługi Google</div><div>Lokalizacja, backup, diagnostyka</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
      </div>
    `,
  },
  {
    id: "security",
    eyebrow: "Krok 6 z 9",
    title: "Blokada ekranu",
    subtitle: "Zabezpiecz telefon przed nieupoważnionym dostępem.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Metoda blokady</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">🔢 PIN (zalecane)</span><span class="oobe-segment-badge">Szybkie</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">🔣 Wzór</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">🔡 Hasło</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">🚫 Brak blokady</span></div>
        </div>
        <div class="oobe-toggle-row" style="margin-top:4px">
          <div><div class="oobe-toggle-label-main">Odblokowanie twarzą</div><div>Kamera przednia</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Odcisk palca</div><div>Czytnik linii papilarnych</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
      </div>
    `,
  },
  {
    id: "privacy",
    eyebrow: "Krok 7 z 9",
    title: "Prywatność",
    subtitle: "Zdecyduj, jakie dane będziesz udostępniać systemowi.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Raporty diagnostyczne</div><div>Anonimowe dane pomagają ulepszać system</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Spersonalizowane reklamy</div><div>Na podstawie Twojej aktywności</div></div>
          <div class="oobe-toggle" style="background:#e5e5ea"><div class="oobe-toggle-knob" style="left:2px"></div></div>
        </div>
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Lokalizacja</div><div>GPS i sieci Wi‑Fi</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Powiadomienia alarmowe</div><div>Komunikaty służb ratunkowych</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
      </div>
    `,
  },
  {
    id: "display",
    eyebrow: "Krok 8 z 9",
    title: "Wygląd",
    subtitle: "Dostosuj wyświetlacz do swoich preferencji.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Motyw</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">☀️ Jasny</span><span class="oobe-segment-badge">Wybrano</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">🌑 Ciemny</span></div>
          <div class="oobe-segment"><span class="oobe-segment-primary">⚙️ Automatyczny</span></div>
        </div>
        <div class="oobe-toggle-row" style="margin-top:4px">
          <div><div class="oobe-toggle-label-main">Rozmiar czcionki</div><div>Domyślny</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Always-on Display</div><div>Pokazuj godzinę w trybie uśpienia</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
      </div>
    `,
  },
  {
    id: "finish",
    eyebrow: "Gotowe!",
    title: "Twój Pure16 jest gotowy",
    subtitle: "Wszystko skonfigurowane. Możesz zaczynać.",
    body: () => `
      <ul class="oobe-list">
        <li>Język i region zostały ustawione</li>
        <li>Wi‑Fi i konto Google skonfigurowane</li>
        <li>Blokada ekranu i prywatność dostosowane</li>
        <li>Podwójnie stuknij zegar, by otworzyć Ustawienia</li>
      </ul>
    `,
  },
];

// ─── Helpers ───
function isLastStep() { return state.stepIndex === OOBE_STEPS.length - 1; }
function setMode(m)   { state.mode = m; render(); }
function goToStep(i, dir) { state.stepIndex = Math.max(0, Math.min(OOBE_STEPS.length-1, i)); renderOobe(dir||"forward"); }
function completeOnboarding() { SafeStorage.set(ONBOARDING_KEY,"1"); setMode("home"); }
function stopClock() { if (state.clockInterval) { clearInterval(state.clockInterval); state.clockInterval=null; } }

// ─── Render ───
function render() {
  stopClock();
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="app-root">
      <div class="status-bar">
        <div class="status-bar-left" id="sbLeft"></div>
        <div class="status-bar-clock" id="statusClock"></div>
        <div class="status-bar-clock-hit" id="statusClockHit"></div>
        <div class="status-bar-right" id="sbRight"></div>
      </div>
      <div class="main-screen" id="mainScreen"></div>
    </div>
  `;

  renderStatusBarIcons();
  attachStatusBarClock();

  if (state.mode === "boot")     renderBootScreen();
  else if (state.mode === "oobe") renderOobe("forward");
  else                            renderHome();
}

// ─── Status bar icons ───
function renderStatusBarIcons() {
  const left  = document.getElementById("sbLeft");
  const right = document.getElementById("sbRight");
  if (!left || !right) return;

  // Left: SIM1, SIM2
  left.innerHTML = `
    <span class="sb-sim">SIM1</span>
    <span class="sb-sim" style="opacity:0.6">SIM2</span>
  `;

  // Right: WiFi, Bluetooth, Battery
  right.innerHTML = `
    <!-- WiFi icon -->
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 9.5C8.69 9.5 9.25 10.06 9.25 10.75S8.69 12 8 12 6.75 11.44 6.75 10.75 7.31 9.5 8 9.5z" fill="#1c1c1e"/>
      <path d="M8 6.5c1.24 0 2.36.5 3.18 1.32l1.06-1.06A6.47 6.47 0 008 5a6.47 6.47 0 00-4.24 1.76l1.06 1.06A4.47 4.47 0 018 6.5z" fill="#1c1c1e"/>
      <path d="M8 3.5c2.21 0 4.21.9 5.66 2.35l1.06-1.06A8.97 8.97 0 008 2 8.97 8.97 0 001.28 4.79l1.06 1.06A6.97 6.97 0 018 3.5z" fill="#1c1c1e" opacity="0.4"/>
    </svg>
    <!-- Bluetooth icon -->
    <svg width="11" height="16" viewBox="0 0 11 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 1l4 4-4 4m0-8V15m0 0l4-4-4-4" stroke="#1c1c1e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
    <!-- Battery -->
    <div class="sb-battery">
      <div class="sb-battery-body"><div class="sb-battery-fill"></div></div>
    </div>
  `;
}

// ─── Status bar clock ───
function attachStatusBarClock() {
  const clockEl = document.getElementById("statusClock");
  const hitEl   = document.getElementById("statusClockHit");
  if (!clockEl || !hitEl) return;

  function updateClock() {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2,"0");
    const mm  = String(now.getMinutes()).padStart(2,"0");
    if (clockEl) clockEl.textContent = `${hh}:${mm}`;
  }
  updateClock();
  state.clockInterval = setInterval(updateClock, 10000);

  hitEl.addEventListener("click", () => {
    const now = Date.now();
    if (now - state.lastClockTap < 400) callBridge("openSettings");
    state.lastClockTap = now;
  });
}

// ─── Boot ───
function renderBootScreen() {
  const container = document.getElementById("mainScreen");
  if (!container) return;

  container.innerHTML = `
    <div class="boot-screen">
      <div style="text-align:center">
        <div class="boot-logo"><span>Pure</span>16</div>
        <div class="boot-device" style="margin-top:8px">Pure16 · Android 16 Edition</div>
      </div>
      <div class="boot-tagline">Czysty, elegancki interfejs stworzony z myślą o perfekcji.</div>
      <div class="boot-progress"><div class="boot-progress-fill"></div></div>
    </div>
  `;

  if (!state.bootTimeoutSet) {
    state.bootTimeoutSet = true;
    setTimeout(() => setMode(state.bootNextMode), 2000);
  }
}

// ─── OOBE ───
function renderOobe(direction) {
  const container = document.getElementById("mainScreen");
  if (!container) return;
  const step = OOBE_STEPS[state.stepIndex];
  if (!step) return;

  // Build dots
  const dots = OOBE_STEPS.map((_,i) =>
    `<div class="oobe-dot${i===state.stepIndex ? " active" : ""}"></div>`
  ).join("");

  container.innerHTML = `
    <div class="oobe-container">
      <div class="oobe-screen ${direction === "backward" ? "slide-in-backward" : "slide-in-forward"}">
        <div>
          <div class="oobe-header-eyebrow">${step.eyebrow}</div>
          <div class="oobe-title">${step.title}</div>
          <div class="oobe-subtitle">${step.subtitle}</div>
          <div class="oobe-body">${step.body()}</div>
        </div>
        <div class="oobe-footer">
          <div class="oobe-dots">${dots}</div>
          <div class="oobe-actions">
            ${state.stepIndex > 0 ? '<button class="btn btn-ghost" id="btnBack">Wstecz</button>' : ""}
            ${!isLastStep() ? '<button class="btn btn-danger" id="btnSkip">Pomiń</button>' : ""}
            <button class="btn btn-primary" id="btnPrimary">${isLastStep() ? "Zaczynajmy" : "Dalej"}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnPrimary")?.addEventListener("click", () => {
    isLastStep() ? completeOnboarding() : goToStep(state.stepIndex + 1, "forward");
  });
  document.getElementById("btnBack")?.addEventListener("click", () => goToStep(state.stepIndex - 1, "backward"));
  document.getElementById("btnSkip")?.addEventListener("click", () => completeOnboarding());
}

// ─── Launcher / Home ───
const ALL_APPS = [
  { emoji:"📞", name:"Telefon",       app:"phone" },
  { emoji:"💬", name:"Wiadomości",    app:"messages" },
  { emoji:"🌐", name:"Przeglądarka",  app:"browser" },
  { emoji:"📷", name:"Aparat",        app:"camera" },
  { emoji:"🧮", name:"Kalkulator",    app:"calculator" },
  { emoji:"🗓️", name:"Kalendarz",     app:"calendar" },
  { emoji:"📧", name:"Gmail",         app:"gmail" },
  { emoji:"🗺️", name:"Mapy",          app:"maps" },
  { emoji:"🎵", name:"Muzyka",        app:"music" },
  { emoji:"📸", name:"Zdjęcia",       app:"photos" },
  { emoji:"⚙️", name:"Ustawienia",    app:"settings" },
  { emoji:"🔦", name:"Latarka",       app:"flashlight" },
  { emoji:"🌤️", name:"Pogoda",        app:"weather" },
  { emoji:"🕐", name:"Zegar",         app:"clock" },
  { emoji:"📝", name:"Notatki",       app:"notes" },
  { emoji:"🛒", name:"Sklep",         app:"store" },
  { emoji:"📁", name:"Pliki",         app:"files" },
  { emoji:"🎙️", name:"Dyktafon",      app:"recorder" },
  { emoji:"🔢", name:"Kontakty",      app:"contacts" },
  { emoji:"📶", name:"Ustawienia Wi",  app:"wifi_settings" },
];

const DOCK_APPS = [
  { emoji:"📞", app:"phone" },
  { emoji:"💬", app:"messages" },
  { emoji:"🌐", app:"browser" },
  { emoji:"📷", app:"camera" },
];

const PAGE_SIZE = 16;

function renderHome() {
  const container = document.getElementById("mainScreen");
  if (!container) return;

  const pages   = Math.ceil(ALL_APPS.length / PAGE_SIZE);
  let curPage   = 0;

  function buildGrid(page) {
    const apps = ALL_APPS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    return apps.map(a => `
      <div class="launcher-icon" data-app="${a.app}">
        <div class="launcher-icon-circle">${a.emoji}</div>
        <div>${a.name}</div>
      </div>
    `).join("");
  }

  function buildDots(active) {
    return Array.from({length: pages}, (_,i) =>
      `<div class="launcher-page-dot${i===active?" active":""}"></div>`
    ).join("");
  }

  function buildDock() {
    return DOCK_APPS.map(a =>
      `<div class="launcher-dock-icon" data-app="${a.app}">${a.emoji}</div>`
    ).join("");
  }

  container.innerHTML = `
    <div class="launcher-container">
      <div id="launcherGrid" class="launcher-grid">
        ${buildGrid(curPage)}
      </div>
      <div class="launcher-page-dots" id="pageDots">${buildDots(curPage)}</div>
      <div class="launcher-dock-wrapper">
        <div class="launcher-dock">${buildDock()}</div>
      </div>
    </div>
  `;

  // Swipe to change page
  let touchStartX = null;
  const grid = document.getElementById("launcherGrid");
  if (grid) {
    grid.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, {passive:true});
    grid.addEventListener("touchend", e => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0 && curPage < pages - 1) curPage++;
      else if (dx > 0 && curPage > 0) curPage--;
      else return;
      grid.innerHTML = buildGrid(curPage);
      document.getElementById("pageDots").innerHTML = buildDots(curPage);
      attachIconListeners();
    }, {passive:true});
  }

  function attachIconListeners() {
    container.querySelectorAll("[data-app]").forEach(el =>
      el.addEventListener("click", () => handleAppLaunch(el.getAttribute("data-app")))
    );
  }
  attachIconListeners();
}

// ─── Bridge ───
function callBridge(method) {
  try { if (window.AndroidBridge && typeof window.AndroidBridge[method]==="function") window.AndroidBridge[method](); } catch(_) {}
}

const APP_BRIDGE_MAP = {
  phone:"openPhone", camera:"openCamera", browser:"openBrowser",
  calculator:"openCalculator", messages:"openMessages", calendar:"openCalendar",
  gmail:"openGmail", maps:"openMaps", music:"openMusic", photos:"openPhotos",
  settings:"openSettings", weather:"openWeather", clock:"openClock",
  notes:"openNotes", store:"openStore", files:"openFiles",
  recorder:"openRecorder", contacts:"openContacts",
};

function handleAppLaunch(app) {
  if (APP_BRIDGE_MAP[app]) callBridge(APP_BRIDGE_MAP[app]);
}

// ─── Init ───
function initApp() {
  let done = false;
  try { done = SafeStorage.get(ONBOARDING_KEY) === "1"; } catch(_) {}

  state.bootNextMode   = done ? "home" : "oobe";
  state.mode           = "boot";
  state.stepIndex      = 0;
  state.bootTimeoutSet = false;
  state.lastClockTap   = 0;

  render();
  OTA.check();
}

document.addEventListener("DOMContentLoaded", initApp);
