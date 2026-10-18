import { defineConfig } from "vite";
const isolatedTest = process.env.WENDAO_E2E === "1";
export default defineConfig({
  envDir: isolatedTest ? false : undefined,
  server: {
    proxy: isolatedTest ? undefined : { "/api/coach": "http://127.0.0.1:8787" },
    watch: { ignored: ["**/artifacts/**", "**/android/**", "**/ios/**", "**/src-tauri/**"] },
  },
});
