import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.wendao.poker",
  appName: "问道牌途",
  webDir: "dist",
  backgroundColor: "#13271e",
  ios: {
    backgroundColor: "#13271e",
    contentInset: "never",
    preferredContentMode: "mobile",
  },
  android: { backgroundColor: "#13271e", allowMixedContent: false },
  plugins: {
    SystemBars: { style: "DARK", initialViewportFitValueHint: "cover" },
  },
};
export default config;
