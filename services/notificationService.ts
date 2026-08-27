import { PantryItem, UserProfile } from '../types';
import { getItems, getShoppingList, getMealPlan, getUserProfile } from './storageService';

/**
 * Browser notifications for the toggles in Settings → System, which previously only
 * saved a boolean and did nothing.
 *
 * Limitation worth knowing: without a service worker and a push server, a web app can
 * only raise notifications while it is actually open. These therefore fire when you
 * open the app (and while it stays open), not in the background on a schedule.
 */

const LAST_SENT_KEY = 'smartpantry_notifications_last_sent';

type NotificationKind = 'expiryAlerts' | 'mealReminders' | 'missingItems' | 'weeklyReport';

const readLastSent = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(LAST_SENT_KEY) || '{}');
  } catch {
    return {};
  }
};

const markSent = (kind: NotificationKind) => {
  const all = readLastSent();
  all[kind] = Date.now();
  try {
    localStorage.setItem(LAST_SENT_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked — not worth failing over */
  }
};

const hoursSince = (kind: NotificationKind): number => {
  const at = readLastSent()[kind];
  if (!at) return Infinity;
  return (Date.now() - at) / (1000 * 60 * 60);
};

export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

/** Ask the browser for permission. Returns whether we can actually notify now. */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

const send = (kind: NotificationKind, title: string, body: string) => {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: `smartpantry-${kind}` });
    markSent(kind);
  } catch {
    /* some browsers block construction outside a user gesture */
  }
};

const daysUntil = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const expiringSoon = (items: PantryItem[]) =>
  items.filter(i => {
    const d = daysUntil(i.expiryDate);
    return d !== null && d >= 0 && d <= 3;
  });

/**
 * Runs the notification checks the user has switched on. Safe to call on every app
 * open — each kind is rate-limited so you don't get the same nag twice in a day.
 */
export const runNotificationChecks = async (profile?: UserProfile): Promise<void> => {
  const settings = (profile ?? getUserProfile())?.settings;
  const notifications = settings?.notifications;
  if (!notifications?.enabled) return;
  if (!notificationsSupported() || Notification.permission !== 'granted') return;

  if (notifications.expiryAlerts && hoursSince('expiryAlerts') >= 12) {
    const soon = expiringSoon(getItems());
    if (soon.length > 0) {
      const names = soon.slice(0, 3).map(i => i.name).join(', ');
      send(
        'expiryAlerts',
        `${soon.length} item${soon.length === 1 ? '' : 's'} expiring soon`,
        `${names}${soon.length > 3 ? ` and ${soon.length - 3} more` : ''} — cook ${soon.length === 1 ? 'it' : 'them'} before ${soon.length === 1 ? 'it goes' : 'they go'} off.`
      );
    }
  }

  if (notifications.missingItems && hoursSince('missingItems') >= 24) {
    const unchecked = getShoppingList().filter(i => !i.checked);
    if (unchecked.length > 0) {
      send(
        'missingItems',
        `${unchecked.length} item${unchecked.length === 1 ? '' : 's'} on your shopping list`,
        `Still to buy: ${unchecked.slice(0, 3).map(i => i.name).join(', ')}${unchecked.length > 3 ? '…' : ''}`
      );
    }
  }

  if (notifications.mealReminders && hoursSince('mealReminders') >= 6) {
    const hour = new Date().getHours();
    const slot = hour < 10 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : null;
    if (slot) {
      const plan = getMealPlan();
      const today = new Date().toLocaleDateString(undefined, { weekday: 'long' });
      const meal = plan?.days
        ?.find(d => d.day === today)
        ?.meals?.find(m => m.type === slot);
      if (meal) send('mealReminders', `${slot}: ${meal.title}`, meal.description || 'From your meal plan.');
    }
  }

  if (notifications.weeklyReport && hoursSince('weeklyReport') >= 24 * 7) {
    const items = getItems();
    const soon = expiringSoon(items).length;
    send(
      'weeklyReport',
      'Your weekly pantry report',
      `${items.length} item${items.length === 1 ? '' : 's'} in the pantry, ${soon} needing attention this week.`
    );
  }
};
