import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import OneSignal from '@onesignal/capacitor-plugin';

let nativeReady = false;

const getOneSignalAppId = () => import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;

export const initNativeApp = async () => {
  if (nativeReady || !Capacitor.isNativePlatform()) return;
  nativeReady = true;

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch (error) {
    console.warn('Status bar setup failed', error);
  }

  const appId = getOneSignalAppId();
  if (!appId) {
    console.warn('OneSignal is installed but VITE_ONESIGNAL_APP_ID is not set.');
    return;
  }

  try {
    OneSignal.initialize(appId);
    await OneSignal.Notifications.requestPermission(false);
  } catch (error) {
    console.warn('OneSignal setup failed', error);
  }
};

export const identifyPushUser = async (userId?: string | null) => {
  if (!Capacitor.isNativePlatform() || !getOneSignalAppId()) return;

  try {
    if (userId) {
      await OneSignal.login(userId);
    } else {
      await OneSignal.logout();
    }
  } catch (error) {
    console.warn('OneSignal user sync failed', error);
  }
};
