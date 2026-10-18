import { spawnSync } from 'node:child_process';

// Dedicated output/origin: never replace a user's normal client or contact a model.
const env = {...process.env, WENDAO_E2E:'1',VITE_NATIVE_AUDIT:'1',VITE_STARTUP_TRACE:'',VITE_COACH_URL:''};
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const [command,args] of [
  [npx,['tsc','--noEmit']],
  [npx,['vite','build','--outDir','artifacts/web-audit']],
  [process.execPath,['scripts/offline.mjs','artifacts/web-audit']],
]) {
  const result=spawnSync(command,args,{env,stdio:'inherit',shell:process.platform==='win32'&&command.endsWith('.cmd')});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
