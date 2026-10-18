import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndroidAudit } from '../../scripts/native-audit-log.mjs';

test('Android 审计分片先还原字节，跨中文 UTF-8 字符边界和乱序仍可完整读取长报告', () => {
  const report = {runToken:'native-test',reply:'修仙牌途的师父教学',rounds:Array.from({length:15},(_,cycle)=>({cycle,hands:6,renderer:'独立渲染进程'}))};
  const bytes = Buffer.from(JSON.stringify(report)), parts: string[] = [];
  for(let i=0;i<bytes.length;i+=17)parts.push(bytes.subarray(i,i+17).toString('base64'));
  const lines=parts.map((part,i)=>`timestamp System.out Native runtime audit part ${i+1}/${parts.length}: ${part}`);
  assert.deepEqual(parseAndroidAudit(lines.reverse()),report);
  assert.throws(()=>parseAndroidAudit(lines.slice(1)),/Missing/);
  assert.throws(()=>parseAndroidAudit([...lines,lines[0]]),/Duplicate/);
  assert.throws(()=>parseAndroidAudit([lines[0].replace(/part \d+\/\d+:/,'part 0/1:')]),/bounds/);
});

test('Android 旧单条报告可读取，缺失或混合损坏的分片不能假装成功', () => {
  assert.deepEqual(parseAndroidAudit(['log Native runtime audit: {"passed":true}']),{passed:true});
  assert.throws(()=>parseAndroidAudit([]));
  assert.throws(()=>parseAndroidAudit(['Native runtime audit part 1/2: e30=','Native runtime audit part 2/3: e30=']),/Mixed/);
  assert.throws(()=>parseAndroidAudit(['Native runtime audit part 1/1: not-base64']),/Malformed/);
});
