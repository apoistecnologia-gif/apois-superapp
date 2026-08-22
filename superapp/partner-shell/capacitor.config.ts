import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.apois.parceiro',
  appName: 'APOIS Parceiro',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    backgroundColor: '#050505',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#050505',
      showSpinner: false,
    },
    StatusBar: {
      // Fundo quase preto exige ícones claros. DARK deixava hora/bateria com
      // baixo contraste no Android e fazia o topo parecer quebrado.
      style: 'LIGHT',
      backgroundColor: '#050505',
    },
  },
};

export default config;
