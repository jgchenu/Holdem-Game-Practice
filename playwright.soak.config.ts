import { defineConfig } from '@playwright/test';
const cycles=Number(process.env.WENDAO_SOAK_CYCLES || 15);
if(!Number.isInteger(cycles)||cycles<1||cycles>30)throw Error('Soak cycles must be 1..30');
export default defineConfig({
  testDir:'./tests/soak',testMatch:'**/*.case.ts',workers:1,
  timeout:cycles*120_000+120_000,expect:{timeout:15_000},
  reporter:'list',outputDir:'artifacts/web-soak-results',
  use:{baseURL:'http://127.0.0.1:5188',browserName:'chromium',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,screenshot:'only-on-failure',trace:'off'},
  webServer:{command:'npm run build:web-audit && npx vite preview --outDir artifacts/web-audit --host 127.0.0.1 --port 5188 --strictPort',url:'http://127.0.0.1:5188',reuseExistingServer:false,env:{WENDAO_E2E:'1'}},
});
