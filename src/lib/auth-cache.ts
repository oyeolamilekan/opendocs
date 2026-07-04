const PROFILE_BOOTSTRAP_CACHE_KEY = "minialdoc:profile-bootstrap";
const PROFILE_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;

let profileBootstrapPromise: Promise<void> | null = null;
let profileBootstrapExpiresAt = 0;

/**
 * Reads the persisted auth profile cache expiry timestamp.
 *
 * @returns Stored expiry timestamp, or zero when unavailable.
 */
const readStoredExpiry = () => {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(
      window.sessionStorage.getItem(PROFILE_BOOTSTRAP_CACHE_KEY),
    );
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

/**
 * Persists the auth profile cache expiry timestamp.
 *
 * @param expiresAt - Expiry timestamp to persist.
 * @returns Nothing is returned.
 */
const storeExpiry = (expiresAt: number) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PROFILE_BOOTSTRAP_CACHE_KEY,
      String(expiresAt),
    );
  } catch {
    // In-memory caching still applies when browser storage is unavailable.
  }
};

/**
 * Ensures the authenticated profile has been fetched recently before protected work continues.
 *
 * @param ensureProfile - Async callback that fetches or validates the current profile.
 * @param [now=Date.now()] - Current timestamp in milliseconds, injectable for tests.
 * @returns Promise that resolves after the profile is confirmed or cache freshness is extended.
 */
export const ensureProfileCached = (
  ensureProfile: () => Promise<unknown>,
  now = Date.now(),
) => {
  const storedExpiry = readStoredExpiry();
  const expiresAt = Math.max(profileBootstrapExpiresAt, storedExpiry);

  if (expiresAt > now) {
    return Promise.resolve();
  }
  if (profileBootstrapPromise) {
    return profileBootstrapPromise;
  }

  const promise = ensureProfile().then(() => {
    const nextExpiry = Date.now() + PROFILE_BOOTSTRAP_TTL_MS;
    profileBootstrapExpiresAt = nextExpiry;
    storeExpiry(nextExpiry);
  });
  profileBootstrapPromise = promise;

  void promise.then(
    () => {
      if (profileBootstrapPromise === promise) {
        profileBootstrapPromise = null;
      }
    },
    () => {
      if (profileBootstrapPromise === promise) {
        profileBootstrapPromise = null;
      }
    },
  );

  return promise;
};

/**
 * Clears the authentication profile freshness cache.
 *
 * @returns Nothing is returned.
 */
export const resetAuthCache = () => {
  profileBootstrapPromise = null;
  profileBootstrapExpiresAt = 0;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(PROFILE_BOOTSTRAP_CACHE_KEY);
    } catch {
      // Nothing else to clear when browser storage is unavailable.
    }
  }
};
