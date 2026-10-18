// XCTest owns UI input; the host samples memory only at acknowledged frozen boundaries.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync,createWriteStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {collectMacMemory,buildMacMemoryHelper,validateMacSoakRound} from './macos-process-memory.mjs';

assert.equal(process.platform,'darwin');
const root=resolve('.'),base=join(root,'artifacts/macos-xctest-soak'),runID=randomUUID();
mkdirSync(base,{recursive:true});
const build=JSON.parse(readFileSync('artifacts/macos-extended-soak/build.json'));
const lock=join(base,'runner.lock'),lockFD=openSync(lock,'wx');
writeFileSync(lockFD,JSON.stringify({pid:process.pid,runID}));
const output=join(base,runID);mkdirSync(output);
const buildOnly=process.argv.includes('--build-only');
const app=join(root,'artifacts/macos-soak-target/release/bundle/macos/问道牌途长测.app'),executable=join(app,'Contents/MacOS/app');
const protectedExecutable=join(root,'src-tauri/target/release/bundle/macos/问道牌途验收.app/Contents/MacOS/app');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const processes=()=>execFileSync('ps',['-ww','-axo','pid=,comm='],{encoding:'utf8'}).trim().split('\n').map(line=>line.trim().match(/^(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),path:m[2]}));
const protectedHash=existsSync(protectedExecutable)?hash(protectedExecutable):null;
const protectedPids=processes().filter(p=>p.path===protectedExecutable).map(p=>p.pid);
const report={passed:false,runID,buildOnly,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktreeStatus:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),appBuild:build,rounds:[],protectedAudit:{sha256Before:protectedHash,pidsBefore:protectedPids},scope:'Independent native XCTest input to the separate soak bundle, complete frozen MEASURE summaries and acknowledged OS coalition samples. JS cadence is not GPU presentation or phone FPS; memory is not a leak verdict. Longer AUDIT raw export is not claimed.'};
const save=()=>{writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');writeFileSync(join(base,'latest.json'),JSON.stringify({runID,report:join(output,'report.json')},null,2)+'\n');};save();
let child,log,completed=false,childCode,signal;
const stop=()=>{if(child?.pid&&!completed)try{process.kill(-child.pid,'SIGTERM');}catch{}};
const pause=()=>new Promise(resolve=>setTimeout(resolve,300));
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 assert.equal(build.passed,true);assert.equal(build.worktreeStatus,'');assert.equal(build.appPath,app);
 assert.equal(hash(executable),build.binarySha256,'Never test a replaced or unrecorded app binary');
 assert.equal(execFileSync('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw','-o','-',join(app,'Contents/Info.plist')],{encoding:'utf8'}).trim(),'com.wendao.poker.soak.desktop');
 // A prior ordinary build can be reused only when all its actual game inputs remain unchanged.
 execFileSync('git',['diff','--exit-code',build.sourceRevision,'--','src','public','src-tauri','index.html','package.json','package-lock.json','vite.config.ts','scripts/platform.mjs','scripts/offline.mjs'],{stdio:'pipe'});
 const helper=buildMacMemoryHelper();
 if(!buildOnly)writeFileSync(join(base,'runtime.json'),JSON.stringify({runID,application:app})+'\n');
 const resultBundle=join(output,'native.xcresult');report.resultBundle=buildOnly?null:resultBundle;save();
 const args=['-project','macos/PracticeUITests.xcodeproj','-scheme','PracticeUITests','-destination','platform=macOS','-derivedDataPath',join(base,'DerivedData'),'CODE_SIGN_IDENTITY=-','SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) MAC_SOAK','-parallel-testing-enabled','NO','-only-testing:PracticeUITests/PracticeUITests/testIsolatedRuntimeSoak',...(buildOnly?['build-for-testing']:['-resultBundlePath',resultBundle,'test'])];
 log=createWriteStream(join(output,'run.log'));
 child=spawn('xcodebuild',args,{cwd:root,stdio:['ignore','pipe','pipe'],detached:true});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 child.once('error',error=>{report.error=String(error);completed=true;childCode=-1;});child.once('close',(code,s)=>{completed=true;childCode=code;signal=s;});
 let baseline=false;
 while(!completed){
  if(!buildOnly){
   const ready=join(output,'ready.json');
   if(!baseline&&existsSync(ready)){
    assert.equal(JSON.parse(readFileSync(ready)).runID,runID);
    const matches=processes().filter(p=>p.path===executable);assert.equal(matches.length,1);
    report.appPid=matches[0].pid;
    report.baseline=collectMacMemory({appPid:report.appPid,appPath:executable,helper,outputFile:join(output,'footprint-baseline.json')});
    baseline=true;save();writeFileSync(join(output,'baseline.ack'),runID);
   }
   const cycle=report.rounds.length+1,file=join(output,`round-${cycle}.json`);
   if(baseline&&cycle<=15&&existsSync(file)){
    const record=JSON.parse(readFileSync(file));assert.equal(record.runID,runID);assert.equal(record.cycle,cycle);
    validateMacSoakRound(record.summary,report.rounds.at(-1)?.summary.starts??0);
    record.memory=collectMacMemory({appPid:report.appPid,appPath:executable,helper,outputFile:join(output,`footprint-round-${cycle}.json`)});
    report.rounds.push(record);save();writeFileSync(join(output,`round-${cycle}.ack`),runID);
    console.log(JSON.stringify({cycle,frames:record.summary.frames,p95Ms:record.summary.p95Ms,completedStates:record.summary.completedHands,processes:record.memory.processes.length}));
   }
  }
  await pause();
 }
 report.exitCode=childCode;report.signal=signal;assert.equal(childCode,0,report.error||'Native XCTest must succeed');
 if(!buildOnly){
  assert.equal(report.rounds.length,15);
  report.tests=JSON.parse(execFileSync('xcrun',['xcresulttool','get','test-results','summary','--path',resultBundle],{encoding:'utf8',timeout:30000}));
  assert.equal(report.tests.failedTests,0);assert.equal(report.tests.passedTests,1);
 }
 report.passed=true;
}catch(error){report.error=String(error);process.exitCode=1;stop();}
finally{
 if(child&&!completed)await new Promise(resolve=>child.once('close',resolve));
 log?.end();process.off('SIGINT',stop);process.off('SIGTERM',stop);
 report.protectedAudit.sha256After=protectedHash&&existsSync(protectedExecutable)?hash(protectedExecutable):null;
 report.protectedAudit.pidsAfter=processes().filter(p=>p.path===protectedExecutable).map(p=>p.pid);
 if(report.protectedAudit.sha256After!==protectedHash||JSON.stringify(report.protectedAudit.pidsAfter)!==JSON.stringify(protectedPids)){report.passed=false;report.error='Protected audit app changed';process.exitCode=1;}
 report.finishedAt=new Date().toISOString();save();closeSync(lockFD);unlinkSync(lock);
 console.log(JSON.stringify({passed:report.passed,buildOnly,rounds:report.rounds.length,report:join(output,'report.json'),error:report.error}));
}
