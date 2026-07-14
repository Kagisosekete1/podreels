// Native push notifications via OneSignal (Capacitor Android/iOS).
// On the web, push is handled by the OneSignal Web SDK in index.html, so this
// module is a no-op unless the app runs inside a Capacitor native shell.
import { Capacitor } from '@capacitor/core';

const ONESIGNAL_APP_ID = '24f646c5-08fb-45e0-bbbc-3ae4f1bdc672';

export async function initNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Loaded lazily so the web bundle never pulls in the Cordova plugin.
    const mod = await import('onesignal-cordova-plugin');
    const OneSignal = (mod as any).default ?? mod;

    OneSignal.initialize(ONESIGNAL_APP_ID);

    // Ask the user to allow notifications (Android 13+ / iOS require this).
    OneSignal.Notifications.requestPermission(true);

    // Foreground notifications: let OneSignal display them in the tray.
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      event.getNotification().display();
    });

    // Tapping a notification.
    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const data = event?.notification?.additionalData;
      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url as string;
      }
    });
  } catch (err) {
    console.warn('[push] OneSignal native init skipped:', err);
  }
}

// Associate the OneSignal device with the signed-in user so you can target them.
export async function setPushExternalUserId(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const mod = await import('onesignal-cordova-plugin');
    const OneSignal = (mod as any).default ?? mod;
    OneSignal.login(userId);
  } catch (err) {
    console.warn('[push] setPushExternalUserId skipped:', err);
  }
}
