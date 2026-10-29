// PWA & Smart Update Manager for Convenio Marts
// Robust installation handler for Android, iOS, and Desktop

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

// Check if currently running as an installed standalone app
export function isAppInstalled() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Device detection for smart install instructions
export function getDeviceInfo() {
  if (typeof window === 'undefined') return { isIOS: false, isAndroid: false, isDesktop: true };
  const ua = window.navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isDesktop = !isIOS && !isAndroid;
  return { isIOS, isAndroid, isDesktop, hasDirectPrompt: Boolean(deferredInstallPrompt) };
}

export function initPwaManager({ onUpdateAvailable, onInstallableChange } = {}) {
  if (onUpdateAvailable) updateCallbacks.add(onUpdateAvailable);
  if (onInstallableChange) installCallbacks.add(onInstallableChange);

  // 1. Always listen for browser native install prompt (Android, Chrome, Edge, Desktop)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    notifyInstallState(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyInstallState(false);
  });

  // Initial installable state: installable if not already running in standalone mode
  const installed = isAppInstalled();
  notifyInstallState(!installed);

  // 2. Register Service Worker in production HTTPS environments
  if (!IS_DEV && 'serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        swRegistration = reg;

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              markUpdateAvailable();
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Service Worker registration:', err);
      });
  }

  // 3. Proactive Version Checking against version.json in production
  if (!IS_DEV) {
    setTimeout(() => checkForAppUpdate(), 4000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

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

  return () => {
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

// Trigger install prompt or signal fallback instructions
export async function promptPwaInstall() {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
        notifyInstallState(false);
      }
      return outcome === 'accepted';
    } catch (err) {
      console.error('PWA install error:', err);
    }
  }
  // Return false so caller can display the instruction modal
  return false;
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
