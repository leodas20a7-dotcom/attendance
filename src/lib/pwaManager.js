// PWA & Instant Update Manager for Convenio Marts
// Ensures instant deploy reflection on mobile and desktop without manual cache clearing

let deferredInstallPrompt = null;
let swRegistration = null;
let updateCallbacks = new Set();
let installCallbacks = new Set();
let isUpdateAvailable = false;
let isChecking = false;

// Embedded build time injected by Vite
const CURRENT_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();

export function initPwaManager({ onUpdateAvailable, onInstallableChange } = {}) {
  if (onUpdateAvailable) updateCallbacks.add(onUpdateAvailable);
  if (onInstallableChange) installCallbacks.add(onInstallableChange);

  // 1. Listen for browser install prompt (Android, Chrome, Edge, Desktop)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    notifyInstallState(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyInstallState(false);
  });

  // Check if already running in standalone installed mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    notifyInstallState(false);
  }

  // 2. Register Service Worker with immediate takeover
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        swRegistration = reg;

        // Check for updates whenever the service worker detects a byte-for-byte change in sw.js
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker has installed and is waiting
              markUpdateAvailable();
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped or failed:', err);
      });

    // When the new service worker takes over, reload or notify
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      markUpdateAvailable();
    });
  }

  // 3. Proactive Version Checking ("Think Smart" deploy detection)
  // Check on startup
  setTimeout(() => checkForAppUpdate(), 3000);

  // Check whenever user brings app to foreground / unlocks phone
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate();
    }
  });

  window.addEventListener('focus', () => {
    checkForAppUpdate();
  });

  window.addEventListener('online', () => {
    checkForAppUpdate();
  });

  // Background check every 2 minutes
  const intervalId = setInterval(() => {
    checkForAppUpdate();
  }, 120000);

  return () => {
    clearInterval(intervalId);
    if (onUpdateAvailable) updateCallbacks.delete(onUpdateAvailable);
    if (onInstallableChange) installCallbacks.delete(onInstallableChange);
  };
}

function notifyInstallState(canInstall) {
  installCallbacks.forEach((cb) => cb(canInstall));
}

function markUpdateAvailable() {
  if (isUpdateAvailable) return;
  isUpdateAvailable = true;
  updateCallbacks.forEach((cb) => cb(true));
}

// Proactive check against /version.json
export async function checkForAppUpdate() {
  if (isChecking) return false;
  isChecking = true;

  try {
    // 1. Tell service worker to check for updates
    if (swRegistration) {
      try {
        await swRegistration.update();
      } catch (e) {
        // Ignore offline network errors
      }
    }

    // 2. Fetch version.json bypassing cache
    const response = await fetch(`/version.json?_ts=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.buildTime && data.buildTime > CURRENT_BUILD_TIME) {
        markUpdateAvailable();
        return true;
      }
    }
  } catch (err) {
    // Network errors during offline or slow connections are safely ignored
  } finally {
    isChecking = false;
  }

  return false;
}

// User or UI calls this to install app
export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return false;
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    notifyInstallState(false);
    return outcome === 'accepted';
  } catch (err) {
    console.error('Error showing PWA prompt:', err);
    return false;
  }
}

// Apply update immediately by clearing caches and reloading
export async function applyImmediateUpdate() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch (e) {
    console.warn('Error clearing caches during update:', e);
  }

  // Force clean reload
  window.location.reload();
}
