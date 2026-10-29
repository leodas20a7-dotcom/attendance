// PWA & Smart Update Manager for Convenio Marts
// Ensures instant deploy reflection without repetitive false alerts

let deferredInstallPrompt = null;
let swRegistration = null;
const updateCallbacks = new Set();
const installCallbacks = new Set();
let isUpdateAvailable = false;
let isChecking = false;

// Version identifier injected by Vite at build time
const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'prod';
const IS_DEV = typeof __IS_DEV__ !== 'undefined' 
  ? __IS_DEV__ 
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function initPwaManager({ onUpdateAvailable, onInstallableChange } = {}) {
  if (onUpdateAvailable) updateCallbacks.add(onUpdateAvailable);
  if (onInstallableChange) installCallbacks.add(onInstallableChange);

  // In local development, unregister any lingering service workers to avoid caching dev files
  if (IS_DEV) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    return () => {};
  }

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

  // 2. Register Service Worker in production only
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        swRegistration = reg;

        // When a genuinely newer service worker is installed
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new service worker has replaced the active one
              markUpdateAvailable();
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Service Worker registration:', err);
      });
  }

  // 3. Proactive Version Checking against version.json
  // Initial check after startup
  setTimeout(() => checkForAppUpdate(), 4000);

  // Check on tab visibility change (e.g. unlocking phone or switching back to app)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // Check every 3 minutes
  const intervalId = setInterval(() => {
    checkForAppUpdate();
  }, 180000);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
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

export function dismissUpdateNotification() {
  isUpdateAvailable = false;
  updateCallbacks.forEach((cb) => cb(false));
}

// Check against server version.json
export async function checkForAppUpdate() {
  if (IS_DEV || isChecking || isUpdateAvailable) return false;
  isChecking = true;

  try {
    if (swRegistration) {
      try {
        await swRegistration.update();
      } catch (e) {
        // Offline errors ignored
      }
    }

    const response = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Only trigger if server version exists, is not 'dev', and is different from CURRENT_APP_VERSION
      if (
        data &&
        data.version &&
        data.version !== 'dev' &&
        data.version !== CURRENT_APP_VERSION &&
        sessionStorage.getItem('convenio_dismissed_version') !== data.version
      ) {
        markUpdateAvailable();
        return true;
      }
    }
  } catch (err) {
    // Offline / network hiccups ignored
  } finally {
    isChecking = false;
  }

  return false;
}

// User prompts PWA install
export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return false;
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    notifyInstallState(false);
    return outcome === 'accepted';
  } catch (err) {
    console.error('PWA install error:', err);
    return false;
  }
}

// Immediate clean update
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
    console.warn('Error during update:', e);
  }

  window.location.reload();
}
