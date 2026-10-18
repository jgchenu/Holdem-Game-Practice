import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProcessGroup, collectWindowsMemoryWithQuery } from '../../scripts/windows-process-memory.mjs';

test('进程内存分组包含渲染子进程与本次配置目录的孤立进程，排除无关窗口及相似路径',()=>{
  const profile='C:\\Test Space\\profile-123';
  const row=(id:number,parent:number,name='msedgewebview2.exe',command='')=>({ProcessId:id,ParentProcessId:parent,Name:name,CommandLine:command});
  const rows=[row(10,1,'app.exe'),row(11,10),row(12,11),row(20,999,'msedgewebview2.exe',`--user-data-dir="${profile}"`),row(21,20),row(22,999,'msedgewebview2.exe',`--user-data-dir="${profile}\\WebView2"`),row(23,22),row(30,1,'app.exe'),row(31,30),row(40,999,'msedgewebview2.exe',`--user-data-dir="${profile}4"`),row(41,40)];
  assert.deepEqual(selectProcessGroup(rows,10,profile).map(p=>p.pid),[10,11,12,20,21,22,23]);
  assert.throws(()=>selectProcessGroup(rows,12345,profile));
});

test('Windows 计数超时后重新采集归属，保留失败，不沿用已经退出的 renderer',()=>{
  let generation=0; const calls:string[]=[];
  const report=collectWindowsMemoryWithQuery(10,'C:\\test-profile',(stage:string)=>{
    calls.push(stage);
    if(stage==='topology') { generation++; return [{ProcessId:10,ParentProcessId:1,Name:'app.exe'},{ProcessId:generation===1?11:12,ParentProcessId:10,Name:'msedgewebview2.exe'},{ProcessId:99,ParentProcessId:1,Name:'msedgewebview2.exe'}]; }
    if(generation===1) throw Object.assign(new Error('OS counters timed out'),{code:'ETIMEDOUT'});
    return [{Pid:10,PrivateBytes:100,WorkingSetBytes:200},{Pid:12,PrivateBytes:300,WorkingSetBytes:400}];
  });
  assert.deepEqual(calls,['topology','counters','topology','counters']);
  assert.deepEqual(report.processes.map((p:any)=>p.pid),[10,12]);
  assert.equal(report.privateBytesSum,400); assert.equal(report.complete,true);
  assert.equal(report.attempts[0].complete,false); assert.equal(report.attempts[0].stage,'counters');
  assert.equal(report.attempts[1].complete,true);
});

test('Windows 重复超时仍失败，缺少任何归属进程的计数也不能算完整采集',()=>{
  let calls=0;
  assert.throws(()=>collectWindowsMemoryWithQuery(10,'C:\\test-profile',()=>{
    calls++; throw Object.assign(new Error('OS read timed out'),{code:'ETIMEDOUT'});
  }),(error:any)=>error.samplingAttempts.length===2 && error.samplingAttempts.every((a:any)=>!a.complete));
  assert.equal(calls,2);
  calls=0;
  assert.throws(()=>collectWindowsMemoryWithQuery(10,'C:\\test-profile',(stage:string)=>{
    calls++;
    return stage==='topology' ? [{ProcessId:10,ParentProcessId:1,Name:'app.exe'},{ProcessId:11,ParentProcessId:10,Name:'msedgewebview2.exe'},{ProcessId:12,ParentProcessId:10,Name:'helper.exe'}] : [{Pid:10,PrivateBytes:100,WorkingSetBytes:200},{Pid:11,PrivateBytes:300,WorkingSetBytes:400}];
  }),/Every selected app process/);
  assert.equal(calls,2,'Missing counters must fail immediately, without accepting a smaller group');
});
