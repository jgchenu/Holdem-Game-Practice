// Project-owned simulator lifecycle/diagnostics around the native XCTest soak.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve,basename} from 'node:path';

assert.equal(process.platform,'darwin');
const device=process.env.IOS_TEST_DEVICE;
assert.ok(device,'Set IOS_TEST_DEVICE to a dedicated Wendao Soak simulator');
const output=resolve('artifacts/ios-extended-soak');mkdirSync(output,{recursive:true});
const run=(args)=>execFileSync('xcrun',args,{encoding:'utf8',timeout:120_000,maxBuffer:16*1024*1024});
const devices=()=>Object.values(JSON.parse(run(['simctl','list','devices','available','--json'])).devices).flat();
const selected=devices().find(d=>d.udid===device);
assert.ok(selected?.name.startsWith('Wendao Soak '),'This lifecycle wrapper only owns its named test simulators');
const unique=()=>assert.ok(devices().filter(d=>d.state==='Booted').every(d=>d.udid===device),'Other booted simulators make WebKit cohort attribution ambiguous');
unique();
if(selected.state==='Booted')run(['simctl','shutdown',device]);
run(['simctl','bootstatus',device,'-b']);
const processes=()=>execFileSync('ps',['-ww','-axo','pid=,ppid=,rss=,comm='],{encoding:'utf8',maxBuffer:16*1024*1024}).trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);return m?{pid:Number(m[1]),parentPid:Number(m[2]),rssBytes:Number(m[3])*1024,path:m[4]}:null;}).filter(Boolean);
const simulatorWebKit=p=>(p.path.includes('/CoreSimulator/')||p.path.includes('/iPhoneSimulator.platform/'))&&/com\.apple\.WebKit\./.test(p.path);
const baseline=processes().filter(simulatorWebKit);
assert.equal(baseline.length,0,'A fresh dedicated simulator must have no pre-existing WebKit client processes');
const result={passed:false,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),device:{udid:device,name:selected.name},scope:'App and WebKit descendants of its dedicated launchd_sim process. Sole booted simulator; baseline had zero WebKit processes. RSS may count shared pages twice and is not iPhone physical/GPU memory.',rounds:[],errors:[]};
const save=()=>writeFileSync(output+'/report.json',JSON.stringify(result,null,2));save();
function memory(){
  unique();
  const services=run(['simctl','spawn',device,'launchctl','list']);
  writeFileSync(output+'/last-services.txt',services);
  const jobs=services.split('\n').map(line=>line.trim().split(/\s+/));
  const roots=jobs.filter(parts=>parts.length>=3&&/^\d+$/.test(parts[0])&&parts[2].includes('UIKitApplication:com.wendao.poker[')).map(parts=>Number(parts[0]));
  assert.equal(roots.length,1,'The app root must be identified in its own simulator bootstrap');
  const rows=processes(),app=rows.find(p=>p.pid===roots[0]);
  assert.ok(app,'App process must still exist');
  const runtime=rows.find(p=>p.pid===app.parentPid);
  assert.equal(basename(runtime?.path||''),'launchd_sim','Identify the actual per-device process ancestor');
  const descendants=new Set([runtime.pid]);
  let changed;
  do{changed=false;for(const p of rows)if(descendants.has(p.parentPid)&&!descendants.has(p.pid)){descendants.add(p.pid);changed=true;}}while(changed);
  const cohort=rows.filter(p=>descendants.has(p.pid)&&(roots.includes(p.pid)||simulatorWebKit(p)));
  assert.ok(cohort.some(p=>roots.includes(p.pid)),'Root process must have memory data');
  assert.ok(cohort.some(p=>/com\.apple\.WebKit\.WebContent/.test(p.path)),'Include the actual renderer, not only the app process');
  return{at:new Date().toISOString(),runtimeRootPid:runtime.pid,processes:cohort.map(p=>({pid:p.pid,parentPid:p.parentPid,name:basename(p.path),rssBytes:p.rssBytes,role:roots.includes(p.pid)?'app':'simulator-WebKit'})),rssBytesSum:cohort.reduce((n,p)=>n+p.rssBytes,0)};
}
writeFileSync(output+'/run.log','');
const child=spawn('npm',['run','audit:ios'],{env:{...process.env,IOS_TEST_DEVICE:device,WENDAO_SOAK_CYCLES:'15'},stdio:['ignore','pipe','pipe'],detached:true});
const stop=()=>{try{process.kill(-child.pid,'SIGTERM');}catch{}};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
const seen=new Set();
for(const stream of [child.stdout,child.stderr]){
  stream.setEncoding('utf8');let pending='';
  stream.on('data',chunk=>{
    appendFileSync(output+'/run.log',chunk);pending+=chunk;
    let newline;
    while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);const marker=line.indexOf('IOS_SOAK_ROUND ');if(marker<0)continue;
      try{
        const measurements=JSON.parse(line.slice(marker+'IOS_SOAK_ROUND '.length));
        if(seen.has(measurements.cycle))continue;seen.add(measurements.cycle);
        const start=Date.now(),snapshot=memory();
        result.rounds.push({cycle:measurements.cycle,measurements,memory:snapshot,samplingMs:Date.now()-start});save();
        console.log(`iOS soak ${measurements.cycle}/15: ${measurements.completedHands} hands, callback P95 ${measurements.p95Ms}ms, cohort ${snapshot.processes.length} processes, RSS ${snapshot.rssBytesSum}`);
      }catch(error){result.errors.push(String(error));save();stop();}
    }
  });
}
try{
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  result.exitCode=code;result.passed=code===0&&result.rounds.length===15&&result.errors.length===0;
  if(!result.passed)process.exitCode=1;
}catch(error){result.errors.push(String(error));process.exitCode=1;}
finally{save();process.off('SIGINT',stop);process.off('SIGTERM',stop);run(['simctl','shutdown',device]);}
