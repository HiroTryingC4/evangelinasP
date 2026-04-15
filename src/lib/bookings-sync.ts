const BOOKINGS_SYNC_EVENT = "bookings:changed";
const BOOKINGS_SYNC_STORAGE_KEY = "evangelinasP:bookings-sync";

export function emitBookingsChanged() {
  if (typeof window === "undefined") return;

  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    window.localStorage.setItem(BOOKINGS_SYNC_STORAGE_KEY, token);
  } catch {
    // Ignore storage failures and still notify the current tab.
  }
  window.dispatchEvent(new Event(BOOKINGS_SYNC_EVENT));
}

export function subscribeBookingsChanged(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === BOOKINGS_SYNC_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(BOOKINGS_SYNC_EVENT, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(BOOKINGS_SYNC_EVENT, callback);
  };
}