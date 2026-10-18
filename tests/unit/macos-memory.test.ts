import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMacProcessGroup,validateMacSoakRound} from '../../scripts/macos-process-memory.mjs';

test('macOS 按两个内核组标识与 UID 区分 WebKit，包含同组非子进程和其他助手',()=>{
  const row=(pid:number,name:string,ids=[10,11],uid=501)=>({pid,parentPid:1,uid,path:name,coalitionIds:ids});
  const rows=[row(100,'/game/app'),row(101,'/WebKit/com.apple.WebKit.WebContent'),row(102,'/WebKit/com.apple.WebKit.GPU'),row(103,'/helper'),row(200,'/WebKit/com.apple.WebKit.WebContent',[20,21]),row(201,'/WebKit/com.apple.WebKit.GPU',[10,99]),row(300,'/other-user/helper',[10,11],502)];
  assert.deepEqual(selectMacProcessGroup(rows,100).map(p=>p.pid),[100,101,102,103]);
  assert.throws(()=>selectMacProcessGroup(rows,999),/Root/);
  assert.throws(()=>selectMacProcessGroup([row(100,'/game/app',[0,0]),...rows.slice(1)],100),/supported/);
  assert.throws(()=>selectMacProcessGroup(rows.filter(p=>p.pid!==101),100),/WebContent/);
});

test('macOS 长测拒绝空帧、缺失牌局、无新增声音和未暂停音频',()=>{
  const valid={elapsedMs:65500,frames:3900,busyFrames:800,completedHands:6,starts:50,audioStates:['suspended'],quality:'fine',reducedMotion:false,p50Ms:17,p95Ms:20,p99Ms:25,maxMs:40,busyP95Ms:20,gapsOver50Ms:0};
  assert.doesNotThrow(()=>validateMacSoakRound(valid,40));
  for(const patch of [{frames:0},{elapsedMs:60000},{busyFrames:0},{completedHands:1},{starts:40},{starts:NaN},{audioStates:[]},{audioStates:['running']},{quality:'low'},{reducedMotion:true},{p95Ms:null},{maxMs:10},{gapsOver50Ms:-1}]) {
    assert.throws(()=>validateMacSoakRound({...valid,...patch},40));
  }
});
