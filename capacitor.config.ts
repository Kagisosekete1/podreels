import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.abfc3757a1b0409dbc3a4ce4bfb29ad3',
  appName: 'Clpped',
  webDir: 'dist',
  server: {
    // Hot-reload from the Lovable sandbox while developing on-device.
    // Comment out the `url` line to run the bundled build instead.
    url: 'https://abfc3757-a1b0-409d-bc3a-4ce4bfb29ad3.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
