const PROFILE_BOOTSTRAP_CACHE_KEY = "minialdoc:profile-bootstrap";
const PROFILE_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;

let profileBootstrapPromise: Promise<void> | null = null;
let profileBootstrapExpiresAt = 0;

function readStoredExpiry() {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(
      window.sessionStorage.getItem(PROFILE_BOOTSTRAP_CACHE_KEY),
    );
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function storeExpiry(expiresAt: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PROFILE_BOOTSTRAP_CACHE_KEY,
      String(expiresAt),
    );
  } catch {
    // In-memory caching still applies when browser storage is unavailable.
  }
}

export function ensureProfileCached(
  ensureProfile: () => Promise<unknown>,
  now = Date.now(),
) {
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
}

export function resetAuthCache() {
  profileBootstrapPromise = null;
  profileBootstrapExpiresAt = 0;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(PROFILE_BOOTSTRAP_CACHE_KEY);
    } catch {
      // Nothing else to clear when browser storage is unavailable.
    }
  }
}
