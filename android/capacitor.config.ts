// ADR-0030. Capacitor config for the DER Android wrap.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ug.ac.mak.der.client',
  appName: 'DER',
  // Capacitor copies this dir into Android assets. Point it at the
  // PWA build output in `../client/dist` after `npm run build`.
  webDir: '../client/dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
