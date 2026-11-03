import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kopela.aitrader',
  appName: 'Kopela AI Trader',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#071511',
    allowMixedContent: false
  },
  server: {
    androidScheme: 'https'
  }
}

export default config
