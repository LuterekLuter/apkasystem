// app.js
// ─────────────────────────────────────────────────────────────────────────────
// OTA Auto-Update
// Sprawdza GitHub Releases przy każdym starcie. Jeśli znajdzie nowszą wersję
// app.js i styles.css, pobiera je, zapisuje w localStorage i przeładowuje.
// ─────────────────────────────────────────────────────────────────────────────

const OTA = (() => {
  // !! Zmień na swoje repozytorium !!
  const GITHUB_REPO  = "luterekluter/apkasystem";
  const CURRENT_VER  = "1.0.0"; // musi być zgodna z tagiem release na GitHubie
  const OTA_KEY      = "ota_version";
  const OTA_JS_KEY   = "ota_app_js";
  const OTA_CSS_KEY  = "ota_styles_css";

  function semverGt(a, b) {
    // zwraca true jeśli a > b (np. "1.1.0" > "1.0.0")
    try {
      const pa = a.replace(/^v/, "").split(".").map(Number);
      const pb = b.replace(/^v/, "").split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return true;
        if ((pa[i] || 0) < (pb[i] || 0)) return false;
      }
      return false;
    } catch (_) { return false; }
  }

  async function fetchText(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  }

  async function check() {
    try {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
      const r = await fetch(apiUrl, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      const tag = (data.tag_name || "").replace(/^v/, "");

      if (!semverGt(tag, CURRENT_VER)) return; // nie ma nowej wersji

      // Pobierz pliki z raw GitHuba (branch main)
      const base = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/web`;
      const [js, css] = await Promise.all([
        fetchText(`${base}/app.js`),
        fetchText(`${base}/styles.css`),
      ]);

      localStorage.setItem(OTA_JS_KEY,  js);
      localStorage.setItem(OTA_CSS_KEY, css);
      localStorage.setItem(OTA_KEY,     tag);

      // Przeładuj — nowe pliki zostaną wstrzyknięte przy starcie
      location.reload();
    } catch (_) {
      // Brak sieci lub błąd — działamy dalej lokalnie
    }
  }

  function applyStored() {
    // Jeśli w localStorage są nowsze pliki, nadpisz je w DOM
    try {
      const storedJS  = localStorage.getItem(OTA_JS_KEY);
      const storedCSS = localStorage.getItem(OTA_CSS_KEY);

      if (storedCSS) {
        let el = document.getElementById("ota-styles");
        if (!el) {
          el = document.createElement("style");
          el.id = "ota-styles";
          document.head.appendChild(el);
        }
        el.textContent = storedCSS;
      }

      if (storedJS) {
        // Nie można ponownie uruchomić bieżącego skryptu, ale
        // następny reload wczyta już app.js z localStorage (patrz niżej).
        // applyStored uruchamia się PRZED initApp więc nadpisanie stanu jest OK.
        // Logika: jeśli stored JS istnieje — eval go w izolowanej funkcji.
        // eslint-disable-next-line no-new-func
        const run = new Function(storedJS);
        run();
        return true; // sygnał: kod został zastąpiony
      }
    } catch (_) {
      // Zepsuty OTA — wyczyść i działaj lokalnie
      try { localStorage.removeItem(OTA_JS_KEY); } catch (_2) {}
    }
    return false;
  }

  return { check, applyStored };
})();

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARDING_KEY = "android16_onboarding_completed";

const state = {
  mode: "boot",        // 'boot' | 'oobe' | 'home'
  stepIndex: 0,
  lastClockTap: 0,
  bootNextMode: "oobe",
  bootTimeoutSet: false,
  clockInterval: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// OOBE Steps
// ─────────────────────────────────────────────────────────────────────────────

const OOBE_STEPS = [
  {
    id: "welcome",
    eyebrow: "Android 16 Clean Edition",
    title: "Witaj",
    subtitle: "Zacznijmy od krótkiej konfiguracji Twojego urządzenia. Całość zajmie tylko chwilę.",
    body: () => `
      <ul class="oobe-list">
        <li>• Ustawisz język i region.</li>
        <li>• Połączysz się z siecią Wi‑Fi.</li>
        <li>• Zadbamy o Twoją prywatność i bezpieczeństwo.</li>
      </ul>
    `,
  },
  {
    id: "language-region",
    eyebrow: "Krok 1 z 10",
    title: "Język i region",
    subtitle: "Dostosuj system do swojego języka i lokalizacji.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Język</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">Polski (Polska)</span><span class="oobe-segment-badge">Wybrane</span></div>
          <div class="oobe-segment"><span>English (United States)</span></div>
          <div class="oobe-segment"><span>Deutsch (Deutschland)</span></div>
        </div>
      </div>
      <div class="oobe-field-group">
        <div class="oobe-field-label">Region</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">Polska</span><span class="oobe-segment-badge">Automatycznie</span></div>
        </div>
      </div>
    `,
  },
  {
    id: "date-time",
    eyebrow: "Krok 2 z 10",
    title: "Data i godzina",
    subtitle: "Upewnij się, że data i czas są poprawnie ustawione.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-input-row">
          <input class="oobe-input" type="date" />
          <input class="oobe-input" type="time" />
        </div>
        <div class="oobe-toggle-row">
          <div>
            <div class="oobe-toggle-label-main">Automatyczna data i godzina</div>
            <div>Użyj sieci, aby ustawić datę i czas.</div>
          </div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
      </div>
    `,
  },
  {
    id: "wifi",
    eyebrow: "Krok 3 z 10",
    title: "Sieć Wi‑Fi",
    subtitle: "Połącz się z siecią, aby kontynuować konfigurację.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Dostępne sieci</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">Dom 5G</span><span>Silny sygnał</span></div>
          <div class="oobe-segment"><span>Dom 2.4G</span><span>Średni sygnał</span></div>
          <div class="oobe-segment"><span>Hotspot</span><span>Słaby sygnał</span></div>
        </div>
        <div class="oobe-field-label" style="margin-top:12px;">Możesz też skonfigurować sieć później.</div>
      </div>
    `,
  },
  {
    id: "copy-data",
    eyebrow: "Krok 4 z 10",
    title: "Kopiowanie danych",
    subtitle: "Przenieś aplikacje, zdjęcia, kontakty i inne dane ze starego urządzenia.",
    body: () => `
      <ul class="oobe-list">
        <li>• Skopiuj dane ze starego telefonu z Androidem.</li>
        <li>• Użyj kopii zapasowej w chmurze.</li>
        <li>• Rozpocznij jako nowe urządzenie.</li>
      </ul>
    `,
  },
  {
    id: "google-services",
    eyebrow: "Krok 5 z 10",
    title: "Usługi Google",
    subtitle: "Pomagają w lokalizacji, aktualizacjach zabezpieczeń i synchronizacji danych.",
    body: () => `
      <ul class="oobe-list">
        <li>• Usługi lokalizacji Google.</li>
        <li>• Wysyłanie danych diagnostycznych.</li>
        <li>• Automatyczna kopia zapasowa w chmurze.</li>
      </ul>
    `,
  },
  {
    id: "google-signin",
    eyebrow: "Krok 6 z 10",
    title: "Zaloguj się do Google",
    subtitle: "Zaloguj się na swoje konto, aby synchronizować aplikacje i dane.",
    body: () => `
      <div class="oobe-field-group">
        <input class="oobe-input" type="email" placeholder="Adres e‑mail" autocomplete="off" />
        <input class="oobe-input" type="password" placeholder="Hasło" autocomplete="off" />
        <div class="oobe-field-label">Możesz pominąć logowanie i zrobić to później w ustawieniach.</div>
      </div>
    `,
  },
  {
    id: "screen-lock",
    eyebrow: "Krok 7 z 10",
    title: "PIN i blokada ekranu",
    subtitle: "Zabezpiecz urządzenie przed nieautoryzowanym dostępem.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-field-label">Metoda blokady</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment"><span class="oobe-segment-primary">PIN</span></div>
          <div class="oobe-segment"><span>Wzór</span></div>
          <div class="oobe-segment"><span>Hasło</span></div>
          <div class="oobe-segment"><span>Brak (niezalecane)</span></div>
        </div>
      </div>
    `,
  },
  {
    id: "privacy",
    eyebrow: "Krok 8 z 10",
    title: "Prywatność",
    subtitle: "Zarządzaj danymi, które będziesz udostępniać systemowi.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Raporty diagnostyczne</div><div>Anonimowe dane pomagają ulepszać system.</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
        <div class="oobe-toggle-row">
          <div><div class="oobe-toggle-label-main">Spersonalizowane sugestie</div><div>Używaj historii aktywności do personalizacji.</div></div>
          <div class="oobe-toggle"><div class="oobe-toggle-knob"></div></div>
        </div>
      </div>
    `,
  },
  {
    id: "summary",
    eyebrow: "Krok 9 z 10",
    title: "Podsumowanie",
    subtitle: "Sprawdź najważniejsze ustawienia przed rozpoczęciem.",
    body: () => `
      <ul class="oobe-list">
        <li>• Język: Polski (Polska)</li>
        <li>• Sieć: możesz połączyć później</li>
        <li>• Konto Google: opcjonalne</li>
        <li>• Blokada ekranu i prywatność: dopasowane do Ciebie</li>
      </ul>
    `,
  },
  {
    id: "finish",
    eyebrow: "Krok 10 z 10",
    title: "Gotowe",
    subtitle: "Twój Android 16 Clean Edition jest przygotowany.",
    body: () => `
      <ul class="oobe-list">
        <li>• Aby wrócić do ustawień, użyj Ustawień systemowych.</li>
        <li>• Dwukrotnie stuknij zegar na pasku statusu, aby otworzyć Ustawienia.</li>
      </ul>
    `,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isLastStep() {
  return state.stepIndex === OOBE_STEPS.length - 1;
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function goToStep(index, direction) {
  state.stepIndex = Math.max(0, Math.min(OOBE_STEPS.length - 1, index));
  renderOobe(direction || "forward");
}

function completeOnboarding() {
  try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch (_) {}
  setMode("home");
}

function stopClock() {
  if (state.clockInterval) {
    clearInterval(state.clockInterval);
    state.clockInterval = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────────

function render() {
  stopClock();
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="app-root">
      <div class="status-bar">
        <div></div>
        <div class="status-bar-clock" id="statusClock"></div>
        <div class="status-bar-clock-hit" id="statusClockHit"></div>
        <div></div>
      </div>
      <div class="main-screen" id="mainScreen"></div>
    </div>
  `;

  attachStatusBarClock();

  if (state.mode === "boot") {
    renderBootScreen();
  } else if (state.mode === "oobe") {
    renderOobe("forward");
  } else {
    renderHome();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot screen
// ─────────────────────────────────────────────────────────────────────────────

function renderBootScreen() {
  const container = document.getElementById("mainScreen");
  if (!container) return;

  container.innerHTML = `
    <div class="boot-screen">
      <div>
        <div class="boot-logo"><span>Pure</span>Vision UI</div>
        <div class="boot-device">Pure16 Developer Edition (A16‑DV)</div>
      </div>
      <div class="boot-tagline">Minimalistyczny interfejs systemowy zaprojektowany dla twórców i perfekcjonistów.</div>
      <div class="boot-progress"><div class="boot-progress-fill"></div></div>
    </div>
  `;

  if (!state.bootTimeoutSet) {
    state.bootTimeoutSet = true;
    setTimeout(() => setMode(state.bootNextMode), 1800);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status bar clock
// ─────────────────────────────────────────────────────────────────────────────

function attachStatusBarClock() {
  const clockEl = document.getElementById("statusClock");
  const hitEl   = document.getElementById("statusClockHit");
  if (!clockEl || !hitEl) return;

  function updateClock() {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, "0");
    const mm  = String(now.getMinutes()).padStart(2, "0");
    if (clockEl) clockEl.textContent = `${hh}:${mm}`;
  }

  updateClock();
  state.clockInterval = setInterval(updateClock, 10000);

  const DOUBLE_TAP_MS = 400;
  hitEl.addEventListener("click", () => {
    const now = Date.now();
    if (now - state.lastClockTap < DOUBLE_TAP_MS) {
      callBridge("openSettings");
    }
    state.lastClockTap = now;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OOBE
// ─────────────────────────────────────────────────────────────────────────────

function renderOobe(direction) {
  const container = document.getElementById("mainScreen");
  if (!container) return;
  const step = OOBE_STEPS[state.stepIndex];
  if (!step) return;

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
          <div class="oobe-progress">Krok ${state.stepIndex + 1} z ${OOBE_STEPS.length}</div>
          <div class="oobe-actions">
            ${state.stepIndex > 0 ? '<button class="btn btn-ghost" id="btnBack">Wstecz</button>' : ""}
            ${!isLastStep() ? '<button class="btn btn-ghost btn-danger" id="btnSkip">Pomiń</button>' : ""}
            <button class="btn btn-primary" id="btnPrimary">${isLastStep() ? "Zakończ" : "Dalej"}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnPrimary = document.getElementById("btnPrimary");
  const btnBack    = document.getElementById("btnBack");
  const btnSkip    = document.getElementById("btnSkip");

  if (btnPrimary) btnPrimary.addEventListener("click", () => {
    isLastStep() ? completeOnboarding() : goToStep(state.stepIndex + 1, "forward");
  });
  if (btnBack) btnBack.addEventListener("click", () => goToStep(state.stepIndex - 1, "backward"));
  if (btnSkip) btnSkip.addEventListener("click", () => completeOnboarding());
}

// ─────────────────────────────────────────────────────────────────────────────
// Home / Launcher
// ─────────────────────────────────────────────────────────────────────────────

function renderHome() {
  const container = document.getElementById("mainScreen");
  if (!container) return;

  container.innerHTML = `
    <div class="launcher-container">
      <div class="launcher-grid">
        <div class="launcher-icon" data-app="camera">
          <div class="launcher-icon-circle">📷</div>
          <div>Aparat</div>
        </div>
        <div class="launcher-icon" data-app="phone">
          <div class="launcher-icon-circle">📞</div>
          <div>Telefon</div>
        </div>
        <div class="launcher-icon" data-app="calculator">
          <div class="launcher-icon-circle">🧮</div>
          <div>Kalkulator</div>
        </div>
        <div class="launcher-icon" data-app="browser">
          <div class="launcher-icon-circle">🌐</div>
          <div>Przeglądarka</div>
        </div>
      </div>
      <div class="launcher-dock-wrapper">
        <div class="launcher-dock">
          <div class="launcher-dock-icon" data-app="phone">📞</div>
          <div class="launcher-dock-icon" data-app="messages">💬</div>
          <div class="launcher-dock-icon" data-app="browser">🌐</div>
          <div class="launcher-dock-icon" data-app="camera">📷</div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-app]").forEach((el) =>
    el.addEventListener("click", () => handleAppLaunch(el.getAttribute("data-app")))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AndroidBridge — bezpieczne wywołania, bez fallbacków które crashują WebView
// ─────────────────────────────────────────────────────────────────────────────

function callBridge(method) {
  try {
    if (window.AndroidBridge && typeof window.AndroidBridge[method] === "function") {
      window.AndroidBridge[method]();
    }
  } catch (e) {
    // cicho — nie crashujemy apki
  }
}

function handleAppLaunch(app) {
  const map = {
    phone:      "openPhone",
    camera:     "openCamera",
    browser:    "openBrowser",
    calculator: "openCalculator",
  };
  if (map[app]) callBridge(map[app]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

function initApp() {
  let completed = false;
  try { completed = localStorage.getItem(ONBOARDING_KEY) === "1"; } catch (_) {}

  state.bootNextMode    = completed ? "home" : "oobe";
  state.mode            = "boot";
  state.stepIndex       = 0;
  state.bootTimeoutSet  = false;
  state.lastClockTap    = 0;

  render();

  // Sprawdź aktualizacje w tle — nie blokuje UI
  OTA.check();
}

document.addEventListener("DOMContentLoaded", initApp);
