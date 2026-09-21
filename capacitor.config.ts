import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arivuppaathai.sudoku',
  appName: 'GenZGames',
  webDir: 'dist',
  plugins: {

  PushNotifications: {
    presentationOptions: [
      "badge",
      "sound",
      "alert",
    ],
  },

  StatusBar: {
    overlaysWebView: false,
    style: 'DARK',
    backgroundColor: '#000000'
  },

  FirebaseAuthentication: {
    skipNativeAuth: true,
    providers: ["google.com"],
  },

}
};

export default config;