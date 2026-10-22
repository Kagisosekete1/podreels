import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clipped.app',
  appName: 'Clipped',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#000000'
    },
    SplashScreen: {
      launchShowDuration: 0,
      splashFullScreen: false,
      splashImmersive: false,
      backgroundColor: '#000000'
    }
  }
};

export default config;
