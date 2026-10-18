import test from 'node:test';
import assert from 'node:assert/strict';
import {collectIosNativeInput, readIosSimulator} from '../../scripts/ios-native-input.mjs';

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

test('模拟器冷机清单查询可在超时后重读一次，保留两次结果', () => {
  let calls = 0;
  const result = readIosSimulator(['list', 'devices', 'available', '--json'], (command: string, args: string[]) => {
    assert.equal(command, 'xcrun');
    assert.deepEqual(args, ['simctl', 'list', 'devices', 'available', '--json']);
    return ++calls === 1 ? timedOut() : {status: 0, stdout: '{"devices":{}}'};
  });
  assert.equal(calls, 2);
  assert.equal(result.status, 0);
  assert.equal(result.attempts[0].code, 'ETIMEDOUT');
  assert.equal(result.attempts[1].complete, true);
});

test('模拟器重采禁止用于创建、启动、关闭或删除设备及其他 App', () => {
  for (const args of [['create', 'name'], ['boot', device], ['shutdown', device], ['delete', device], ['get_app_container', device, 'another.app', 'data'], ['get_app_container', device, 'com.wendao.poker', 'groups']]) {
    assert.throws(() => readIosSimulator(args, () => { throw Error('Must not execute a mutation'); }), /Only simulator inventory/);
  }
});
