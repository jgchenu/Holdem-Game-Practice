// Independent cold simulator suites. A failure stops the sequence; it is never retried.
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readIosSimulator} from './ios-native-input.mjs';

assert.equal(process.platform,'darwin','iOS cold-entry verification requires macOS and Xcode');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=join(root,'artifacts');mkdirSync(output,{recursive:true});
const runToken=randomUUID();
const xcrun=args=>execFileSync('xcrun',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024}).trim();
const report={passed:false,phase:'preparing',requestedSuites:3,completedSuites:0,runToken,
  sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim(),
  worktreeStatus:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),
  template:null,existingBootedDevices:[],suites:[],
  scope:'Three independently created simulators, each with its own first app process, first teaching tap, guide scroll, native persistence and trial suite. Stop on any failure; no first-tap or suite retry. Only devices created by this invocation are shut down and deleted.'};
const save=()=>writeFileSync(join(output,'ios-cold-entry.json'),JSON.stringify(report,null,2)+'\n');save();
const artifacts=()=>readdirSync(output).filter(name=>/^ios-native-(?:\d+\.xcresult|input-\d+\.json)$/.test(name));
let child,cancelled=false;
const stop=()=>{cancelled=true;if(child?.pid)try{process.kill(-child.pid,'SIGTERM');}catch{}};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
  const discovery=readIosSimulator(['list','devices','available','--json']);
  report.discovery={attempts:discovery.attempts};save();
  if(discovery.error||discovery.status!==0)
    throw new Error(`Simulator discovery failed: ${discovery.error?.message||discovery.stderr||discovery.status}`);
  const listing=JSON.parse(discovery.stdout);
  const candidates=Object.entries(listing.devices).flatMap(([runtime,devices])=>devices.map(device=>({...device,runtime})))
    .filter(device=>device.runtime.includes('.iOS-')&&device.deviceTypeIdentifier?.includes('iPhone'));
  const template=candidates.find(device=>device.udid===process.env.IOS_TEST_DEVICE)||candidates.find(device=>device.deviceTypeIdentifier.endsWith('iPhone-17-Pro'))||candidates[0];
  assert.ok(template,'An available iPhone runtime and device type are required');
  report.template={runtime:template.runtime,deviceType:template.deviceTypeIdentifier};
  report.existingBootedDevices=candidates.filter(d=>d.state==='Booted').map(d=>d.udid);save();
  for(let index=1;index<=3;index++){
    assert.equal(cancelled,false,'Cold-entry verification was interrupted');
    const name=`Wendao Cold Entry ${runToken.slice(0,8)} ${index}`;
    const device=xcrun(['simctl','create',name,template.deviceTypeIdentifier,template.runtime]);
    assert.match(device,/^[0-9A-F-]{36}$/i);
    const suite={index,device,name,passed:false,startedAt:new Date().toISOString(),artifacts:[],cleanup:[]};
    report.suites.push(suite);report.phase='running';save();
    const before=new Set(artifacts());
    try{
      console.log(`Cold iOS suite ${index}/3: ${name} (${device})`);
      child=spawn(process.execPath,['scripts/platform.mjs','ios-test'],{cwd:root,env:{...process.env,IOS_TEST_DEVICE:device,WENDAO_E2E:'1'},stdio:'inherit',detached:true});
      const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
      child=null;suite.exitCode=result.code;suite.signal=result.signal;
      suite.artifacts=artifacts().filter(name=>!before.has(name));
      assert.equal(result.code,0,'Every independent first-entry suite must pass; the failed suite is not retried');
      const results=suite.artifacts.filter(name=>name.endsWith('.xcresult'));
      assert.equal(results.length,1,'Exactly one xcresult must belong to this suite');
      suite.tests=JSON.parse(xcrun(['xcresulttool','get','test-results','summary','--path',join(output,results[0])]));
      assert.equal(suite.tests.failedTests,0);assert.ok(suite.tests.passedTests>=3);
      const traces=suite.artifacts.filter(name=>name.endsWith('.json'));assert.equal(traces.length,1);
      const trace=JSON.parse(readFileSync(join(output,traces[0]),'utf8'));
      assert.equal(trace.device,device);assert.equal(trace.captureSucceeded,true,'Current-run native observer evidence must actually be captured');
      suite.inputRecords=trace.entries.length;suite.passed=true;report.completedSuites++;
      console.log(`Cold iOS suite ${index}/3 passed: ${suite.tests.passedTests} functional tests, ${suite.tests.skippedTests} intentional skips`);
    }finally{
      suite.artifacts=artifacts().filter(name=>!before.has(name));suite.finishedAt=new Date().toISOString();
      // The UUID was created just above, never taken from the existing device list.
      for(const action of ['shutdown','delete']){
        const result=spawnSync('xcrun',['simctl',action,device],{cwd:root,encoding:'utf8',timeout:30000});
        suite.cleanup.push({action,status:result.status,error:result.error?.message,stderr:result.stderr});
      }
      save();
      assert.equal(suite.cleanup.at(-1).status,0,'The generated simulator must be cleaned up');
    }
  }
  report.passed=true;report.phase='complete';
}catch(error){report.error=String(error);report.phase='failed';console.error(report.error);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
