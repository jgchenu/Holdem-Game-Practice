import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '**/offline.spec.ts', timeout: 60_000,
  outputDir: 'artifacts/offline-tests', reporter: 'list',
  use: { baseURL: 'http://localhost:4173', viewport: {width:390,height:844}, trace: 'retain-on-failure' },
  webServer: {command:'npm run preview -- --port 4173 --strictPort', url:'http://localhost:4173', reuseExistingServer:false},
  projects:[{name:'offline-chromium',use:{browserName:'chromium'}},{name:'offline-webkit',use:{browserName:'webkit'}}],
});
