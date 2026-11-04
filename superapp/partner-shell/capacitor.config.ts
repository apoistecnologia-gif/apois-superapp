import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.apois.parceiro',
  appName: 'APOIS Parceiro',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    backgroundColor: '#F7F7F8',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#F7F7F8',
      showSpinner: false,
    },
    StatusBar: {
      // Fundo claro usa ícones escuros para acompanhar a nova identidade vermelho/branco.
      style: 'DARK',
      backgroundColor: '#F7F7F8',
    },
  },
};

export default config;
