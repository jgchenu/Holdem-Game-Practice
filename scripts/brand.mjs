import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,cpSync,copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
process.chdir(root);
const npx=process.platform==='win32'?'npx.cmd':'npx';
function tauri(args){const result=spawnSync(npx,['tauri','icon',...args],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});if(result.status!==0)process.exit(result.status||1);}
tauri(['resources/icon.svg','--ios-color','#13271e']);
copyFileSync('src-tauri/icons/ios/AppIcon-512@2x.png','ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
cpSync('src-tauri/icons/android','android/app/src/main/res',{recursive:true});
mkdirSync('public',{recursive:true});copyFileSync('src-tauri/icons/icon.png','public/icon.png');copyFileSync('resources/icon.svg','public/icon.svg');
tauri(['resources/icon.svg','--output','artifacts/pwa-icons','--png','192','--png','512']);
for(const size of [192,512])copyFileSync(`artifacts/pwa-icons/${size}x${size}.png`,`public/icon-${size}.png`);
const icon=readFileSync('resources/icon.svg','utf8').replace(/<svg[^>]+>/,'<svg x="1024" y="1024" width="684" height="684" viewBox="0 0 1024 1024">');
writeFileSync('resources/splash.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><path fill="#13271e" d="M0 0h2732v2732H0z"/>${icon}</svg>`);
tauri(['resources/splash.svg','--output','artifacts/brand-splash','--png','2732']);
for(const name of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'])copyFileSync('artifacts/brand-splash/2732x2732.png',`ios/App/App/Assets.xcassets/Splash.imageset/${name}`);
console.log('品牌图标与 iOS 启动画面已生成。');
