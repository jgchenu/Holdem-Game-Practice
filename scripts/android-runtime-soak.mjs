// Project-owned emulator instrumentation and progress observer; never sends UI input itself.
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,appendFileSync,readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
import {isolatedEmulator} from './android-test-device.mjs';

const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||(process.platform==='darwin'?join(homedir(),'Library/Android/sdk'):process.platform==='win32'?join(process.env.LOCALAPPDATA||'','Android/Sdk'):join(homedir(),'Android/Sdk'));
const adb=join(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb');
const run=args=>execFileSync(adb,args,{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
const device=isolatedEmulator(run(['devices']),process.env.ANDROID_SERIAL);
assert.equal(run(['-s',device,'shell','getprop','ro.kernel.qemu']).trim(),'1');
const output=resolve('artifacts/android-extended-soak');mkdirSync(output,{recursive:true});
const token=randomUUID(),result={passed:false,runToken:token,device,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktreeStatus:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),scope:'Real emulator instrumentation. Live log summaries are progress only; complete native report and assertions decide acceptance.',rounds:[],errors:[],observerWarnings:[]};
const save=()=>writeFileSync(join(output,'observer.json'),JSON.stringify(result,null,2)+'\n');save();
writeFileSync(join(output,'run.log'),'');
const logcat=spawn(adb,['-s',device,'logcat','-v','raw','-s','WendaoSoak:I','*:S'],{stdio:['ignore','pipe','pipe']});
let pending='';
logcat.stdout.setEncoding('utf8');
logcat.stdout.on('data',chunk=>{
  pending+=chunk;let end;
  while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(!line.startsWith('ROUND '))continue;
    try{const round=JSON.parse(line.slice(6));if(round.runToken!==token||result.rounds.some(r=>r.cycle===round.cycle))continue;result.rounds.push(round);save();console.log(`Android soak ${round.cycle}/15: ${round.hands} hands, callback P95 ${round.p95Ms}ms, ${round.processes.length} processes, PSS ${round.pssBytesSum}`);}
    catch(error){result.observerWarnings.push('Progress log: '+String(error));save();}
  }
});
logcat.stderr.on('data',chunk=>appendFileSync(join(output,'observer-errors.log'),chunk));
logcat.on('error',error=>{result.observerWarnings.push('Log observer: '+String(error));save();});
const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','audit:android'],{env:{...process.env,ANDROID_SERIAL:device,WENDAO_SOAK_CYCLES:'15',WENDAO_AUDIT_RUN_TOKEN:token,WENDAO_LIVE_AI:'0',WENDAO_COACH_FIXTURE:'0',WENDAO_GRAPHICS_COMPARE:'0'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32',shell:process.platform==='win32'});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>appendFileSync(join(output,'run.log'),chunk));
const stop=()=>{try{process.platform==='win32'?child.kill('SIGTERM'):process.kill(-child.pid,'SIGTERM');}catch{}};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
const watchdog=setTimeout(()=>{result.errors.push('Overall test timeout');save();stop();},35*60*1000);
try{
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});result.exitCode=code;
  const files=readdirSync('artifacts').filter(name=>/^android-native-runtime-\d+\.json$/.test(name));
  const reports=files.map(file=>({file,report:JSON.parse(readFileSync(join('artifacts',file),'utf8'))})).filter(r=>r.report.runToken===token);
  if(code===0){assert.equal(reports.length,1,'Exactly one complete native report must belong to this run');const native=reports[0].report;assert.equal(native.soak?.passed,true);assert.equal(native.soak.completedCycles,15);assert.equal(native.soak.rounds.length,15);assert.ok(native.soak.rounds.every(r=>r.status==='complete'&&r.memory.complete));result.nativeReport=reports[0].file;writeFileSync(join(output,'report.json'),JSON.stringify(native,null,2)+'\n');result.passed=true;}
  if(!result.passed)process.exitCode=1;
}catch(error){result.errors.push(String(error));process.exitCode=1;}
finally{clearTimeout(watchdog);process.off('SIGINT',stop);process.off('SIGTERM',stop);logcat.kill();save();}
