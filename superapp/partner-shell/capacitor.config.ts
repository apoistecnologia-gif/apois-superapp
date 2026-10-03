import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.apois.parceiro',
  appName: 'APOIS Parceiro',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
    },
    StatusBar: {
      // Fundo claro usa ícones escuros; alteração exclusivamente visual do chrome nativo.
      style: 'DARK',
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
