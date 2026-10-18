import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMacProcessGroup} from '../../scripts/macos-process-memory.mjs';

test('macOS 按两个内核组标识与 UID 区分 WebKit，包含同组非子进程和其他助手',()=>{
  const row=(pid:number,name:string,ids=[10,11],uid=501)=>({pid,parentPid:1,uid,path:name,coalitionIds:ids});
  const rows=[row(100,'/game/app'),row(101,'/WebKit/com.apple.WebKit.WebContent'),row(102,'/WebKit/com.apple.WebKit.GPU'),row(103,'/helper'),row(200,'/WebKit/com.apple.WebKit.WebContent',[20,21]),row(201,'/WebKit/com.apple.WebKit.GPU',[10,99]),row(300,'/other-user/helper',[10,11],502)];
  assert.deepEqual(selectMacProcessGroup(rows,100).map(p=>p.pid),[100,101,102,103]);
  assert.throws(()=>selectMacProcessGroup(rows,999),/Root/);
  assert.throws(()=>selectMacProcessGroup([row(100,'/game/app',[0,0]),...rows.slice(1)],100),/supported/);
  assert.throws(()=>selectMacProcessGroup(rows.filter(p=>p.pid!==101),100),/WebContent/);
});
