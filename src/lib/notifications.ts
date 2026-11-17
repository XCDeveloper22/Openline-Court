export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported';

export interface CourtPushPayload {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
}

const STORAGE_PREFIX = 'openline_court_notified_v1_';

const PINK_COURT_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#BE185D"/><rect x="10" y="14" width="44" height="36" rx="3" fill="none" stroke="#FFFFFF" stroke-width="3"/><line x1="32" y1="14" x2="32" y2="50" stroke="#FBCFE8" stroke-width="3"/><line x1="21" y1="14" x2="21" y2="50" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="2"/><line x1="43" y1="14" x2="43" y2="50" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="2"/></svg>'
  );

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): BrowserNotificationPermission {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return getNotificationPermission();
  }
}

export function sendBrowserNotification(payload: CourtPushPayload): boolean {
  if (!isNotificationSupported()) return false;
  try {
    if (Notification.permission !== 'granted') return false;
    const notification = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: PINK_COURT_ICON
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore focus restrictions
      }
      payload.onClick?.();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function readNotifiedKeys(uid: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export function saveNotifiedKey(uid: string, key: string): void {
  try {
    const set = readNotifiedKeys(uid);
    set.add(key);
    const trimmed = Array.from(set).slice(-120);
    window.localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(trimmed));
  } catch {
    // ignore storage quota or private mode failures
  }
}
