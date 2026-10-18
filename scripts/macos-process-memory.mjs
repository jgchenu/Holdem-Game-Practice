import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';

const validIds = ids => Array.isArray(ids) && ids.length === 2 && ids.every(id => Number.isSafeInteger(id) && id > 0);
const sameIds = (a,b) => validIds(a) && validIds(b) && a.every((id,i) => id === b[i]);

/** Kernel ownership, including helpers whose name/parent does not resemble the app. */
export function selectMacProcessGroup(rows, rootPid) {
  const root = rows.find(p => p.pid === rootPid);
  assert.ok(root && validIds(root.coalitionIds), 'Root must have an actual supported coalition result');
  const group = rows.filter(p => p.uid === root.uid && sameIds(p.coalitionIds,root.coalitionIds));
  assert.ok(group.some(p => p.pid === rootPid), 'Root must be present');
  assert.ok(group.some(p => /\/com\.apple\.WebKit\.WebContent$/.test(p.path)), 'The real WebContent renderer must be measured');
  return group.sort((a,b) => a.pid-b.pid);
}

export function buildMacMemoryHelper() {
  assert.equal(process.platform,'darwin');mkdirSync('artifacts',{recursive:true});
  const binary=resolve('artifacts/macos-process-coalition');
  execFileSync('clang',['-O2',resolve('scripts/macos-process-coalition.c'),'-o',binary],{timeout:30000});
  return binary;
}

export function collectMacMemory({appPid,appPath,helper=resolve('artifacts/macos-process-coalition'),outputFile}) {
  assert.equal(process.platform,'darwin');assert.ok(Number.isSafeInteger(appPid)&&appPid>0);
  assert.ok(typeof outputFile==='string'&&outputFile.endsWith('.json'),'Provide a separate raw footprint JSON output path');
  assert.ok(appPath.endsWith('/问道牌途长测.app/Contents/MacOS/app'),'Only the separate soak bundle can be sampled by this runner');
  const started=Date.now(),uid=process.getuid();
  function snapshot(){
    const text=execFileSync('ps',['-ww','-axo','pid=,ppid=,uid=,rss=,stat=,comm='],{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});
    const rows=text.trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);return m?{pid:Number(m[1]),parentPid:Number(m[2]),uid:Number(m[3]),rssBytes:Number(m[4])*1024,state:m[5],path:m[6]}:null;}).filter(p=>p&&p.uid===uid&&!p.state.startsWith('Z'));
    const probes=JSON.parse(execFileSync(helper,rows.map(p=>String(p.pid)),{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024}));
    assert.equal(probes.length,rows.length,'Every candidate must have a diagnostic result');
    const data=new Map(probes.map(p=>[p.pid,p]));
    const unresolved=[];
    for(const row of rows){const probe=data.get(row.pid);if(probe?.returnedBytes===40&&probe.errno===0&&validIds(probe.coalitionIds))row.coalitionIds=probe.coalitionIds;else unresolved.push(row.pid);}
    return {rows,unresolved};
  }
  const before=snapshot(),root=before.rows.find(p=>p.pid===appPid);
  assert.ok(root,'Soak app must still exist');assert.equal(realpathSync(root.path),realpathSync(appPath),'Root must be the intended executable');
  const observer=before.rows.find(p=>p.pid===process.pid);
  assert.ok(observer&&validIds(observer.coalitionIds),'Observer identity must be measurable');
  assert.ok(!sameIds(root.coalitionIds,observer.coalitionIds),'Launch the app through LaunchServices; do not inherit the observer coalition');
  const group=selectMacProcessGroup(before.rows,appPid);
  const output=resolve(outputFile);mkdirSync(dirname(output),{recursive:true});
  execFileSync('/usr/bin/footprint',['--noCategories','-f','bytes',...group.flatMap(p=>['-p',String(p.pid)]),'-j',output],{encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024});
  const footprint=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(footprint.unit,'byte');assert.equal(footprint['bytes per unit'],1);
  assert.deepEqual(footprint.errors,[],'Footprint must measure every selected process');assert.deepEqual(footprint.warnings,[],'Warnings need investigation before accepting the sample');
  assert.deepEqual(footprint.processes.map(p=>p.pid).sort((a,b)=>a-b),group.map(p=>p.pid));
  const after=snapshot(),afterGroup=selectMacProcessGroup(after.rows,appPid);
  assert.deepEqual(afterGroup.map(p=>[p.pid,p.path,...p.coalitionIds]),group.map(p=>[p.pid,p.path,...p.coalitionIds]),'Cohort must remain stable across system sampling');
  const unresolvedStillLive=before.unresolved.filter(pid=>after.rows.some(p=>p.pid===pid));
  assert.deepEqual(unresolvedStillLive,[],'A live process with unknown ownership could hide a group member');
  const counters=new Map(footprint.processes.map(p=>[p.pid,p]));
  return {at:new Date().toISOString(),samplingMs:Date.now()-started,complete:true,rootPid:appPid,coalitionIds:root.coalitionIds,
    processes:group.map(p=>({...p,footprintBytes:counters.get(p.pid).footprint,physicalFootprintBytes:counters.get(p.pid).auxiliary?.phys_footprint})),
    rssBytesSum:group.reduce((n,p)=>n+p.rssBytes,0),toolTotalFootprintBytes:footprint['total footprint'],exitedUnresolvedCandidates:before.unresolved,
    scope:'Same-user app coalition identified by both kernel IDs, independent from observer; all selected processes must be measured, including WebContent. RSS from first OS snapshot and footprint tool counters are sequential, not atomic, and are not unique RAM, GPU memory or a leak verdict. Host diagnostic ABI only; never shipped in game.'};
}
