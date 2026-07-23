import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.salsoaforaneo.app",
  appName: "Ventas la Salsoa Foráneo",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
