/**
 * Server-Authoritative Time Sync Module
 * 
 * Prevents employees from manipulating their phone clock to fake punch times.
 * Fetches the real server time from Supabase's HTTP Date header, calculates
 * the offset from the device clock, and provides getServerNow() to always
 * return the true server time.
 * 
 * How it works:
 * 1. On app load, sends a lightweight HEAD request to Supabase REST API
 * 2. Reads the standard HTTP "Date" response header (server's UTC clock)
 * 3. Measures round-trip latency and calculates: offset = serverTime - (localBefore + localAfter) / 2
 * 4. All attendance functions use getServerNow() instead of new Date()
 * 5. Re-syncs every 30 minutes to handle clock drift
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

// Clock offset in milliseconds: positive = device is behind server, negative = device is ahead
let clockOffset = 0;
let lastSyncTime = 0;
let syncInProgress = false;
let syncSucceeded = false;

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // Re-sync every 30 minutes

/**
 * Sync with the Supabase server to determine the clock offset.
 * Uses the HTTP Date header which is always present in server responses.
 */
export async function syncServerTime() {
  if (syncInProgress) return syncSucceeded;
  syncInProgress = true;

  try {
    const localBefore = Date.now();

    // Lightweight HEAD request — no data transferred, just headers
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    const localAfter = Date.now();
    const dateHeader = response.headers.get('Date');

    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      
      if (!isNaN(serverTime)) {
        // Use the midpoint of request to account for network latency
        const localMidpoint = Math.round((localBefore + localAfter) / 2);
        const roundTripMs = localAfter - localBefore;
        clockOffset = serverTime - localMidpoint;
        lastSyncTime = Date.now();
        syncSucceeded = true;

        const offsetSec = (clockOffset / 1000).toFixed(1);
        const direction = clockOffset > 0 ? 'behind' : clockOffset < 0 ? 'ahead of' : 'in sync with';
        console.log(
          `[ServerTime] ✅ Synced successfully. Device is ${Math.abs(offsetSec)}s ${direction} server. ` +
          `(RTT: ${roundTripMs}ms)`
        );
      }
    } else {
      console.warn('[ServerTime] No Date header in response');
    }
  } catch (err) {
    console.warn('[ServerTime] ⚠️ Failed to sync server time, using device clock:', err.message);
    // Keep existing offset (or 0 if never synced) — graceful fallback
  } finally {
    syncInProgress = false;
  }

  return syncSucceeded;
}

/**
 * Get the current server-authoritative time as a Date object.
 * Falls back to device time if sync hasn't succeeded.
 */
export function getServerNow() {
  // Trigger background re-sync if stale (non-blocking)
  if (Date.now() - lastSyncTime > SYNC_INTERVAL_MS && lastSyncTime > 0) {
    syncServerTime();
  }
  return new Date(Date.now() + clockOffset);
}

/**
 * Get the current server-authoritative timestamp in epoch milliseconds.
 */
export function getServerTimestamp() {
  if (Date.now() - lastSyncTime > SYNC_INTERVAL_MS && lastSyncTime > 0) {
    syncServerTime();
  }
  return Date.now() + clockOffset;
}

/**
 * Check whether server time sync has been established.
 */
export function isServerTimeSynced() {
  return syncSucceeded;
}

/**
 * Get the current clock offset in milliseconds (for debugging/display).
 * Positive = device is behind server, Negative = device is ahead.
 */
export function getClockOffset() {
  return clockOffset;
}

/**
 * Initialize server time sync. Call once on app startup.
 * Returns true if sync succeeded, false if it failed (will use device clock).
 */
export async function initServerTime() {
  return await syncServerTime();
}
