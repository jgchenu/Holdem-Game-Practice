// Build a separate, unsigned host-test bundle. Never replaces the user's audit app.
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {buildMacMemoryHelper} from './macos-process-memory.mjs';

assert.equal(process.platform,'darwin');
const output=resolve('artifacts/macos-extended-soak');mkdirSync(output,{recursive:true});
const appPath=resolve('artifacts/macos-soak-target/release/bundle/macos/问道牌途长测.app');
const executable=join(appPath,'Contents/MacOS/app');
const protectedExecutable=resolve('src-tauri/target/release/bundle/macos/问道牌途验收.app/Contents/MacOS/app');
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const protectedHash=existsSync(protectedExecutable)?hash(protectedExecutable):null;
const processes=()=>execFileSync('ps',['-ww','-axo','pid=,comm='],{encoding:'utf8'}).trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(.+)$/);return m?{pid:Number(m[1]),path:m[2]}:null;}).filter(Boolean);
assert.ok(!processes().some(p=>p.path===executable),'An existing soak app must be inspected or closed before replacing its bundle');
const protectedPids=processes().filter(p=>p.path===protectedExecutable).map(p=>p.pid);
const result={passed:false,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktreeStatus:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),appPath,executable,protectedAudit:{executable:protectedExecutable,pidsBefore:protectedPids,sha256Before:protectedHash},scope:'Separate bundle identifier, storage and Cargo target directory. Build checks only; not runtime or performance acceptance.'};
const save=()=>writeFileSync(join(output,'build.json'),JSON.stringify(result,null,2)+'\n');save();
try{
  const command=spawnSync(process.execPath,['scripts/platform.mjs','desktop-soak'],{cwd:resolve('.'),env:{...process.env,WENDAO_LIVE_AI:'0',WENDAO_COACH_FIXTURE:'0',WENDAO_E2E:'1'},stdio:'inherit'});
  if(command.error)throw command.error;assert.equal(command.status,0,'Isolated native build must succeed');
  const identifier=execFileSync('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw','-o','-',join(appPath,'Contents/Info.plist')],{encoding:'utf8'}).trim();
  assert.equal(identifier,'com.wendao.poker.soak.desktop','Check identity before the test app can be opened');
  result.bundleIdentifier=identifier;result.binarySha256=hash(executable);result.memoryHelper=buildMacMemoryHelper();
  result.passed=true;
}catch(error){result.error=String(error);process.exitCode=1;}
finally{
  if(protectedHash){result.protectedAudit.sha256After=existsSync(protectedExecutable)?hash(protectedExecutable):null;result.protectedAudit.bytesUnchanged=result.protectedAudit.sha256After===protectedHash;
    if(!result.protectedAudit.bytesUnchanged){result.passed=false;result.error='Existing audit bundle changed unexpectedly';process.exitCode=1;}}
  result.protectedAudit.pidsAfter=processes().filter(p=>p.path===protectedExecutable).map(p=>p.pid);save();
}
