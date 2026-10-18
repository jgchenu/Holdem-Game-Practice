import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

/** Include descendants plus any reparented WebView owned by our unique test profile. */
export function selectProcessGroup(rows, rootPid, profile) {
  assert.ok(Number.isSafeInteger(rootPid) && rootPid > 0);
  assert.ok(rows.some(p => Number(p.ProcessId) === rootPid), 'The app must still exist');
  const owned = new Set([rootPid]);
  const escaped = profile.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const profileArgument = new RegExp(`(?:^|[=\\s"'])${escaped}(?=["'\\s/\\\\]|$)`,'i');
  const profileRoots = rows.filter(p => /msedgewebview2/i.test(p.Name) && profileArgument.test(p.CommandLine || '')).map(p => Number(p.ProcessId));
  profileRoots.forEach(pid => owned.add(pid));
  let changed;
  do {
    changed = false;
    for(const p of rows) if(owned.has(Number(p.ParentProcessId)) && !owned.has(Number(p.ProcessId))) {
      owned.add(Number(p.ProcessId)); changed = true;
    }
  } while(changed);
  return rows.filter(p => owned.has(Number(p.ProcessId))).map(p => ({pid:Number(p.ProcessId),parentPid:Number(p.ParentProcessId),name:p.Name,profileRoot:profileRoots.includes(Number(p.ProcessId))}));
}

function readSnapshot(rootPid, profile, run) {
  const topology = run('topology', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress');
  const group = selectProcessGroup(Array.isArray(topology)?topology:[topology],rootPid,profile);
  // Only validated numeric PIDs enter the command; profile paths stay out of shell code.
  assert.ok(group.every(p => Number.isSafeInteger(p.pid) && p.pid > 0));
  const memory = run('counters', `Get-Process -Id ${group.map(p=>p.pid).join(',')} -ErrorAction SilentlyContinue | ForEach-Object { $_.Refresh(); [PSCustomObject]@{Pid=$_.Id;PrivateBytes=$_.PrivateMemorySize64;WorkingSetBytes=$_.WorkingSet64} } | ConvertTo-Json -Compress`);
  const byPid = new Map((Array.isArray(memory)?memory:[memory]).filter(Boolean).map(p=>[Number(p.Pid),p]));
  const processes = group.filter(p=>byPid.has(p.pid)).map(p=>({...p,privateBytes:Number(byPid.get(p.pid).PrivateBytes),workingSetBytes:Number(byPid.get(p.pid).WorkingSetBytes)}));
  assert.ok(processes.some(p=>p.pid===rootPid),'Root app memory must be sampled');
  assert.ok(processes.some(p=>/msedgewebview2/i.test(p.name)),'The sample must actually include WebView2 processes');
  assert.ok(processes.every(p=>Number.isSafeInteger(p.privateBytes)&&p.privateBytes>0&&Number.isSafeInteger(p.workingSetBytes)&&p.workingSetBytes>0));
  const missingPids = group.filter(p=>!byPid.has(p.pid)).map(p=>p.pid);
  assert.deepEqual(missingPids, [], 'Every selected app process must have a real counter');
  return {at:new Date().toISOString(),complete:missingPids.length===0,missingPids,processes,
    privateBytesSum:processes.reduce((n,p)=>n+p.privateBytes,0),
    workingSetBytesSum:processes.reduce((n,p)=>n+p.workingSetBytes,0),
    scope:'App descendants plus owned test-profile WebViews. Working-set sum can double-count shared pages; separate OS/GPU allocations are not measured. Not itself a leak verdict.'};
}

/** Retry only a timed-out read, with a completely new ownership snapshot. */
export function collectWindowsMemoryWithQuery(rootPid, profile, query) {
  const started = Date.now(), attempts = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptStarted = Date.now(); let stage = 'topology';
    try {
      const result = readSnapshot(rootPid, profile, (nextStage, script) => {
        stage = nextStage; return query(nextStage, script);
      });
      attempts.push({complete:true, durationMs:Date.now()-attemptStarted});
      return {...result, samplingMs:Date.now()-started, attempts};
    } catch (error) {
      attempts.push({complete:false, stage, durationMs:Date.now()-attemptStarted, code:error.code ?? null, message:error.message});
      if (error.code !== 'ETIMEDOUT' || attempt === 2) {
        const failure = new Error(`Windows memory ${stage} query failed: ${error.message}`, {cause:error});
        failure.samplingAttempts = attempts; throw failure;
      }
      console.warn(`Windows memory ${stage} read timed out; collecting a fresh process group once. The failed attempt stays in the report.`);
    }
  }
}

export function collectWindowsMemory(rootPid, profile) {
  assert.equal(process.platform,'win32');
  return collectWindowsMemoryWithQuery(rootPid, profile, (_stage, script) =>
    JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);'+script],{encoding:'utf8',timeout:20_000,maxBuffer:16*1024*1024}).trim()));
}
