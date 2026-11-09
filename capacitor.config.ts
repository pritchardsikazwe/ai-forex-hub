import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'online.kopam.app',
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