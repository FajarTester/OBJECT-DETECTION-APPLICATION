import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.obdeapp.app",
  appName: "OBDEAPP",
  webDir: "dist",

  android: {
    // Development LAN:
    // izinkan WebView melakukan koneksi mixed content,
    // termasuk ws:// ke FastAPI lokal.
    allowMixedContent: true,
  },

  server: {
    // Tetap gunakan HTTPS untuk localhost Capacitor.
    // Jangan ubah androidScheme menjadi http karena aplikasi
    // juga menggunakan getUserMedia() untuk kamera.
    androidScheme: "https",
  },
};

export default config;
