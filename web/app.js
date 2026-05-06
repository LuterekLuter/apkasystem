// app.js

const ONBOARDING_KEY = "android16_onboarding_completed";

const state = {
  mode: "boot", // 'boot' | 'oobe' | 'home'
  stepIndex: 0,
  lastClockTap: 0,
  bootNextMode: "oobe",
  bootTimeoutSet: false
};

const OOBE_STEPS = [
  {
    id: "welcome",
    eyebrow: "Android 16 Clean Edition",
    title: "Witaj",
    subtitle:
      "Zacznijmy od krótkiej konfiguracji Twojego urządzenia. Całość zajmie tylko chwilę.",
    body: () => `
      <ul class="oobe-list">
        <li>• Ustawisz język i region.</li>
        <li>• Połączysz się z siecią Wi‑Fi.</li>
        <li>• Zadbamy o Twoją prywatność i bezpieczeństwo.</li>
      </ul>
    `
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
          <div class="oobe-segment">
            <span class="oobe-segment-primary">Polski (Polska)</span>
            <span class="oobe-segment-badge">Wybrane</span>
          </div>
          <div class="oobe-segment">
            <span>English (United States)</span>
          </div>
          <div class="oobe-segment">
            <span>Deutsch (Deutschland)</span>
          </div>
        </div>
      </div>
      <div class="oobe-field-group">
        <div class="oobe-field-label">Region</div>
        <div class="oobe-segment-list">
          <div class="oobe-segment">
            <span class="oobe-segment-primary">Polska</span>
            <span class="oobe-segment-badge">Automatycznie</span>
          </div>
        </div>
      </div>
    `
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
          <div class="oobe-toggle">
            <div class="oobe-toggle-knob"></div>
          </div>
        </div>
      </div>
    `
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
          <div class="oobe-segment">
            <span class="oobe-segment-primary">Dom 5G</span>
            <span>Silny sygnał</span>
          </div>
          <div class="oobe-segment">
            <span>Dom 2.4G</span>
            <span>Średni sygnał</span>
          </div>
          <div class="oobe-segment">
            <span>Hotspot</span>
            <span>Słaby sygnał</span>
          </div>
        </div>
        <div class="oobe-field-label" style="margin-top:12px;">
          Możesz też skonfigurować sieć później.
        </div>
      </div>
    `
  },
  {
    id: "copy-data",
    eyebrow: "Krok 4 z 10",
    title: "Kopiowanie danych",
    subtitle:
      "Przenieś aplikacje, zdjęcia, kontakty i inne dane ze starego urządzenia.",
    body: () => `
      <ul class="oobe-list">
        <li>• Skopiuj dane ze starego telefonu z Androidem.</li>
        <li>• Użyj kopii zapasowej w chmurze.</li>
        <li>• Rozpocznij jako nowe urządzenie.</li>
      </ul>
    `
  },
  {
    id: "google-services",
    eyebrow: "Krok 5 z 10",
    title: "Usługi Google",
    subtitle:
      "Pomagają w lokalizacji, aktualizacjach zabezpieczeń i synchronizacji danych.",
    body: () => `
      <ul class="oobe-list">
        <li>• Usługi lokalizacji Google.</li>
        <li>• Wysyłanie danych diagnostycznych.</li>
        <li>• Automatyczna kopia zapasowa w chmurze.</li>
      </ul>
    `
  },
  {
    id: "google-signin",
    eyebrow: "Krok 6 z 10",
    title: "Zaloguj się do Google",
    subtitle:
      "Zaloguj się na swoje konto, aby synchronizować aplikacje i dane.",
    body: () => `
      <div class="oobe-field-group">
        <input class="oobe-input" type="email" placeholder="Adres e‑mail" />
        <input class="oobe-input" type="password" placeholder="Hasło" />
        <div class="oobe-field-label">
          Możesz pominąć logowanie i zrobić to później w ustawieniach.
        </div>
      </div>
    `
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
          <div class="oobe-segment">
            <span class="oobe-segment-primary">PIN</span>
          </div>
          <div class="oobe-segment">
            <span>Wzór</span>
          </div>
          <div class="oobe-segment">
            <span>Hasło</span>
          </div>
          <div class="oobe-segment">
            <span>Brak (niezalecane)</span>
          </div>
        </div>
      </div>
    `
  },
  {
    id: "privacy",
    eyebrow: "Krok 8 z 10",
    title: "Prywatność",
    subtitle: "Zarządzaj danymi, które będziesz udostępniać systemowi.",
    body: () => `
      <div class="oobe-field-group">
        <div class="oobe-toggle-row">
          <div>
            <div class="oobe-toggle-label-main">Raporty diagnostyczne</div>
            <div>Anonimowe dane pomagają ulepszać system.</div>
          </div>
          <div class="oobe-toggle">
            <div class="oobe-toggle-knob"></div>
          </div>
        </div>
        <div class="oobe-toggle-row">
          <div>
            <div class="oobe-toggle-label-main">Spersonalizowane sugestie</div>
            <div>Używaj historii aktywności do personalizacji.</div>
          </div>
          <div class="oobe-toggle">
            <div class="oobe-toggle-knob"></div>
          </div>
        </div>
      </div>
    `
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
    `
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
    `
  }
];

function isLastStep() {
  return state.stepIndex === OOBE_STEPS.length - 1;
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function goToStep(index, direction = "forward") {
  const clamped = Math.max(0, Math.min(OOBE_STEPS.length - 1, index));
  state.stepIndex = clamped;
  renderOobe(direction);
}

function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch (_) {
    // ignore
  }
  setMode("home");
}

/* UI rendering */

function render() {
  const root = document.getElementById("app");
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

/* Boot / PureVision UI */

function renderBootScreen() {
  const container = document.getElementById("mainScreen");

  container.innerHTML = `
    <div class="boot-screen">
      <div>
        <div class="boot-logo">
          <span>Pure</span>Vision UI
        </div>
        <div class="boot-device">
          Pure16 Developer Edition (A16‑DV)
        </div>
      </div>
      <div class="boot-tagline">
        Minimalistyczny interfejs systemowy zaprojektowany dla twórców i perfekcjonistów.
      </div>
      <div class="boot-progress">
        <div class="boot-progress-fill"></div>
      </div>
    </div>
  `;

  if (!state.bootTimeoutSet) {
    state.bootTimeoutSet = true;
    setTimeout(() => {
      setMode(state.bootNextMode);
    }, 1800);
  }
}

function attachStatusBarClock() {
  const clockEl = document.getElementById("statusClock");
  const hitEl = document.getElementById("statusClockHit");

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    clockEl.textContent = `${hh}:${mm}`;
  }

  updateClock();
  setInterval(updateClock, 30_000);

  const DOUBLE_TAP_MS = 350;

  hitEl.addEventListener("click", () => {
    const now = Date.now();
    if (now - state.lastClockTap < DOUBLE_TAP_MS) {
      if (window.AndroidBridge && typeof AndroidBridge.openSettings === "function") {
        try {
          AndroidBridge.openSettings();
        } catch (e) {
          console.log("AndroidBridge.openSettings() error", e);
        }
      }
    }
    state.lastClockTap = now;
  });
}

function renderOobe(direction) {
  const container = document.getElementById("mainScreen");
  const step = OOBE_STEPS[state.stepIndex];

  const progressText = `Krok ${state.stepIndex + 1} z ${OOBE_STEPS.length}`;

  container.innerHTML = `
    <div class="oobe-container">
      <div class="oobe-screen ${
        direction === "backward" ? "slide-in-backward" : "slide-in-forward"
      }">
        <div>
          <div class="oobe-header-eyebrow">${step.eyebrow}</div>
          <div class="oobe-title">${step.title}</div>
          <div class="oobe-subtitle">${step.subtitle}</div>
          <div class="oobe-body">
            ${step.body()}
          </div>
        </div>
        <div class="oobe-footer">
          <div class="oobe-progress">${progressText}</div>
          <div class="oobe-actions">
            ${
              state.stepIndex > 0
                ? '<button class="btn btn-ghost" id="btnBack">Wstecz</button>'
                : ""
            }
            ${
              !isLastStep()
                ? '<button class="btn btn-ghost btn-danger" id="btnSkip">Pomiń</button>'
                : ""
            }
            <button class="btn btn-primary" id="btnPrimary">${
              isLastStep() ? "Zakończ" : "Dalej"
            }</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnNext = document.getElementById("btnPrimary");
  const btnBack = document.getElementById("btnBack");
  const btnSkip = document.getElementById("btnSkip");

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (isLastStep()) {
        completeOnboarding();
      } else {
        goToStep(state.stepIndex + 1, "forward");
      }
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      goToStep(state.stepIndex - 1, "backward");
    });
  }

  if (btnSkip) {
    btnSkip.addEventListener("click", () => {
      completeOnboarding();
    });
  }
}

function renderHome() {
  const container = document.getElementById("mainScreen");

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

  container
    .querySelectorAll("[data-app]")
    .forEach((el) =>
      el.addEventListener("click", () =>
        handleAppLaunch(el.getAttribute("data-app"))
      )
    );
}

/* Launching real apps (via JS bridge, z fallbackami) */

function handleAppLaunch(app) {
  const hasBridge = !!(window.AndroidBridge && typeof AndroidBridge === "object");

  if (hasBridge) {
    try {
      switch (app) {
        case "phone":
          if (typeof AndroidBridge.openPhone === "function") {
            AndroidBridge.openPhone();
            return;
          }
          break;
        case "camera":
          if (typeof AndroidBridge.openCamera === "function") {
            AndroidBridge.openCamera();
            return;
          }
          break;
        case "browser":
          if (typeof AndroidBridge.openBrowser === "function") {
            AndroidBridge.openBrowser();
            return;
          }
          break;
        case "calculator":
          if (typeof AndroidBridge.openCalculator === "function") {
            AndroidBridge.openCalculator();
            return;
          }
          break;
        default:
          break;
      }
    } catch (e) {
      console.log("AndroidBridge error", e);
    }
  }

  // Fallbacki webowe, gdy nie ma natywnego bridge
  switch (app) {
    case "phone":
      window.location.href = "tel:";
      break;
    case "browser":
      window.location.href = "https://www.google.com";
      break;
    case "calculator":
      alert("Nie znaleziono aplikacji kalkulatora.");
      break;
    case "camera":
      alert("Aparat wymaga natywnej obsługi (AndroidBridge).");
      break;
    default:
      break;
  }
}

/* Init */

function initApp() {
  let completed = false;
  try {
    completed = localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch (_) {
    completed = false;
  }

  state.bootNextMode = completed ? "home" : "oobe";
  state.mode = "boot";
  state.stepIndex = 0;
  state.bootTimeoutSet = false;

  render();
}

document.addEventListener("DOMContentLoaded", initApp);
