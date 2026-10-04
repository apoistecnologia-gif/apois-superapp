import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.apois.app',
  appName: 'APOIS Cliente',
  webDir: 'dist',
  server: {
    // Maps JavaScript roda dentro do WebView. Fixamos uma origem HTTPS estável
    // para que a chave Web possa ser autorizada no Google Cloud de forma determinística.
    hostname: 'localhost',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#050505',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#050505',
      overlaysWebView: false,
    },
  },
};

export default config;
