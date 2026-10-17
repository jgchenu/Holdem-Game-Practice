import { spawnSync } from 'node:child_process';
import { existsSync,mkdirSync,writeFileSync,copyFileSync,readFileSync,rmSync,statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const target=process.argv[2];
const env={...process.env};
const npm=process.platform==='win32'?'npm.cmd':'npm';
const npx=process.platform==='win32'?'npx.cmd':'npx';
const packages=join(root,'artifacts','packages');mkdirSync(packages,{recursive:true});
const lock=join(root,'artifacts','.platform-build-lock');
const lockOwner=join(lock,'owner');
let locked=false;
for(let attempt=0;attempt<600;attempt++){
  try{mkdirSync(lock);writeFileSync(lockOwner,String(process.pid));locked=true;break;}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    try{const pid=Number(readFileSync(lockOwner,'utf8'));if(pid)process.kill(pid,0);}
    catch(error){if(error.code==='ESRCH'||(error.code==='ENOENT'&&Date.now()-statSync(lock).mtimeMs>30_000)){rmSync(lock,{recursive:true,force:true});continue;}}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
if(!locked)throw new Error('另一个平台构建仍在运行，请稍后重试。');
process.once('exit',()=>rmSync(lock,{recursive:true,force:true}));
const cargo=join(homedir(),'.cargo','bin');if(existsSync(cargo))env.PATH=cargo+(process.platform==='win32'?';':':')+env.PATH;
function run(command,args,cwd=root){
  const result=spawnSync(command,args,{cwd,env,stdio:'inherit',shell:process.platform==='win32'&&command.endsWith('.cmd')});
  if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
if(!['sync','android','android-test','ios-sim','ios-device','desktop','desktop-debug'].includes(target)){
  console.error('Usage: node scripts/platform.mjs sync|android|android-test|ios-sim|ios-device|desktop|desktop-debug');process.exit(1);
}
if(target.startsWith('desktop')){
  run(npx,['tauri','build',...(target==='desktop-debug'?['--debug','--no-bundle']:['--bundles',process.platform==='win32'?'nsis':'app,dmg'])]);
  process.exit(0);
}
run(npm,['run','build']);
run(npx,['cap','sync']);
if(target==='sync')process.exit(0);
if(target==='android'||target==='android-test'){
  const studioJava=process.platform==='darwin'?'/Applications/Android Studio.app/Contents/jbr/Contents/Home':null;
  if(!env.JAVA_HOME&&studioJava&&existsSync(studioJava))env.JAVA_HOME=studioJava;
  const sdk=env.ANDROID_HOME||env.ANDROID_SDK_ROOT||(process.platform==='darwin'?join(homedir(),'Library/Android/sdk'):process.platform==='win32'?join(env.LOCALAPPDATA||'','Android/Sdk'):join(homedir(),'Android/Sdk'));
  if(!existsSync(sdk))throw new Error('找不到 Android SDK，请设置 ANDROID_HOME。');
  env.ANDROID_HOME=sdk;
  writeFileSync(join(root,'android','local.properties'),`sdk.dir=${sdk.replaceAll('\\','\\\\').replaceAll(':','\\:')}\n`);
  // Exercise our installed app; dependency libraries own separate, unrelated test suites.
  run(process.platform==='win32'?'gradlew.bat':'./gradlew',[target==='android-test'?':app:connectedDebugAndroidTest':':app:assembleDebug'],join(root,'android'));
  copyFileSync(join(root,'android/app/build/outputs/apk/debug/app-debug.apk'),join(packages,'wendao-android-debug.apk'));
  console.log('Android 调试 APK：artifacts/packages/wendao-android-debug.apk');
}else{
  if(process.platform!=='darwin')throw new Error('iOS 构建需要 macOS 与 Xcode。');
  const simulator=target==='ios-sim';
  const derived=join(root,'artifacts',simulator?'ios':'ios-device');
  run('xcodebuild',['-project','ios/App/App.xcodeproj','-scheme','App','-sdk',simulator?'iphonesimulator':'iphoneos','-destination',simulator?'generic/platform=iOS Simulator':'generic/platform=iOS','-derivedDataPath',derived,'CODE_SIGNING_ALLOWED=NO','build']);
  console.log(simulator?'iOS 模拟器产物：artifacts/ios/Build/Products/Debug-iphonesimulator/App.app':'iOS 真机未签名产物：artifacts/ios-device/Build/Products/Debug-iphoneos/App.app；安装到真机前须由开发者签名。');
}
