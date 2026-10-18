import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';

/** Bounded read recovery also covers CoreSimulator's first inventory request. */
export function readIosSimulator(args, query = spawnSync) {
  const inventory = args.length === 4 && args.join(' ') === 'list devices available --json';
  const containerRead = args.length === 4 && args[0] === 'get_app_container'
    && /^[0-9a-f-]{36}$/i.test(args[1]) && args[2] === 'com.wendao.poker' && ['app','data'].includes(args[3]);
  assert.ok(inventory || containerRead, 'Only simulator inventory and our app container may use read recovery');
  const attempts = [];
  let container;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    container = query('xcrun', ['simctl', ...args], {
      encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
    });
    const complete = container.status === 0 && !container.error;
    attempts.push({complete, status: container.status, durationMs: Date.now() - started,
      code: container.error?.code ?? null, error: container.error?.message || container.stderr?.trim() || undefined});
    if (complete || container.error?.code !== 'ETIMEDOUT') break;
    // Only repeat this read-only query; a fresh path must come from the same
    // simulator and app. Keep the failed attempt in the exported report.
  }
  return {...container, attempts};
}

/** Read evidence after XCTest; never launch the app or inject/retry input. */
export function collectIosNativeInput(device, runStartedAtUnixMs, query = spawnSync, read = readFileSync) {
  assert.match(device, /^[0-9a-f-]{36}$/i);
  assert.ok(Number.isSafeInteger(runStartedAtUnixMs) && runStartedAtUnixMs > 0);
  const container = readIosSimulator(['get_app_container', device, 'com.wendao.poker', 'data'], query);
  let entries = null, error, rawLog, rawRecordCount = 0;
  try {
    if (container.status !== 0 || container.error)
      throw new Error(container.error?.message || container.stderr || 'Test app container is unavailable');
    const path = container.stdout.trim();
    assert.ok(path.startsWith('/'), 'The app container must be an absolute path');
    rawLog = read(join(path, 'Library', 'Caches', 'wendao-native-input.jsonl'), 'utf8');
    const records = rawLog.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    rawRecordCount = records.length;
    entries = records.filter(record => typeof record.atUnixMs === 'number' && record.atUnixMs >= runStartedAtUnixMs);
  } catch (failure) { error = failure.message; }
  const observerInstalled = Array.isArray(entries) && entries.some(record => record.event === 'observer-ready');
  if (!observerInstalled && !error) error = 'No observer installation marker belongs to this test run';
  return {device, runStartedAtUnixMs, captureSucceeded: observerInstalled, observerInstalled,
    status: container.status, attempts: container.attempts, error, rawRecordCount,
    excludedOlderRecords: entries === null ? null : rawRecordCount - entries.length,
    entries, rawLog: entries === null ? rawLog : undefined,
    scope: "Existing outer UIScrollView pan recognizer and test-build installation markers only, from this test app's known cache file and limited to this run. Only an ETIMEDOUT container query is retried once; XCTest and first input are never retried. No recognizer or cancellation behavior is changed; absence of a pan event does not identify another recognizer."};
}
