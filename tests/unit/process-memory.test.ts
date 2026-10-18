import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProcessGroup } from '../../scripts/windows-process-memory.mjs';

test('进程内存分组包含渲染子进程与本次配置目录的孤立进程，排除无关窗口及相似路径',()=>{
  const profile='C:\\Test Space\\profile-123';
  const row=(id:number,parent:number,name='msedgewebview2.exe',command='')=>({ProcessId:id,ParentProcessId:parent,Name:name,CommandLine:command});
  const rows=[row(10,1,'app.exe'),row(11,10),row(12,11),row(20,999,'msedgewebview2.exe',`--user-data-dir="${profile}"`),row(21,20),row(30,1,'app.exe'),row(31,30),row(40,999,'msedgewebview2.exe',`--user-data-dir="${profile}4"`),row(41,40)];
  assert.deepEqual(selectProcessGroup(rows,10,profile).map(p=>p.pid),[10,11,12,20,21]);
  assert.throws(()=>selectProcessGroup(rows,12345,profile));
});
