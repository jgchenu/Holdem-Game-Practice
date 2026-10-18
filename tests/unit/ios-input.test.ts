import test from 'node:test';
import assert from 'node:assert/strict';
import {collectIosNativeInput} from '../../scripts/ios-native-input.mjs';

const device = '574F619C-F289-424D-9CAC-1CF69BF5F746';
const timedOut = () => ({status: null, error: Object.assign(new Error('simctl timed out'), {code: 'ETIMEDOUT'})});

test('iOS 证据查询超时后重新读取同一 App 的路径，保留失败且排除旧进程记录', () => {
  const calls: any[] = [], reads: string[] = [];
  const report = collectIosNativeInput(device, 1000, (command: string, args: string[], options: any) => {
    calls.push({command, args, timeout: options.timeout});
    return calls.length === 1 ? timedOut() : {status: 0, stdout: '/own-current-app\n'};
  }, (path: string) => {
    reads.push(path);
    return [
      {event: 'observer-ready', atUnixMs: 999, pid: 1},
      {event: 'observer-ready', atUnixMs: 1001, pid: 2},
      {event: 'outer-pan', atUnixMs: 1002, pid: 2},
    ].map(x => JSON.stringify(x)).join('\n');
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.command === 'xcrun' && c.timeout === 30000));
  assert.deepEqual(calls[0].args, ['simctl', 'get_app_container', device, 'com.wendao.poker', 'data']);
  assert.deepEqual(calls[1].args, calls[0].args);
  assert.deepEqual(reads, ['/own-current-app/Library/Caches/wendao-native-input.jsonl']);
  assert.equal(report.captureSucceeded, true);
  assert.deepEqual(report.attempts.map((a: any) => a.complete), [false, true]);
  assert.equal(report.attempts[0].code, 'ETIMEDOUT');
  assert.equal(report.excludedOlderRecords, 1);
  assert.deepEqual(report.entries.map((e: any) => e.pid), [2, 2]);
});

test('iOS 连续读超时仍失败，不能用旧文件或功能通过替代记录', () => {
  let calls = 0;
  const report = collectIosNativeInput(device, 1000, () => { calls++; return timedOut(); }, () => { throw Error('Must not read a stale container'); });
  assert.equal(calls, 2);
  assert.equal(report.captureSucceeded, false);
  assert.equal(report.entries, null);
  assert.equal(report.attempts.length, 2);
});

test('iOS 非超时错误不重试，缺失本轮 observer 标记也不能通过', () => {
  let calls = 0;
  const failed = collectIosNativeInput(device, 1000, () => { calls++; return {status: 1, stderr: 'App unavailable'}; });
  assert.equal(calls, 1);
  assert.equal(failed.captureSucceeded, false);
  const stale = collectIosNativeInput(device, 1000, () => ({status: 0, stdout: '/own-app'}), () => JSON.stringify({event: 'observer-ready', atUnixMs: 999}));
  assert.equal(stale.captureSucceeded, false);
  assert.deepEqual(stale.entries, []);
  assert.match(stale.error, /No observer/);
});
