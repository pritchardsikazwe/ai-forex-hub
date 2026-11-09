import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Keep the existing application ID so current Android installs can update in place.
  appId: 'com.kopela.aitrader',
  appName: 'Kopam.online',
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