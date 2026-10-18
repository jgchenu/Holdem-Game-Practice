// Host-side Android lifecycle test. The instrumentation process cannot kill itself and report results.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { isolatedEmulator } from './android-test-device.mjs';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const output = resolve('artifacts/android-process-death');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'result.json'), JSON.stringify({ passed: false, status: 'not completed' }));
assert.ok(sdk, 'Set ANDROID_HOME to the Android SDK');
const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const appId = 'com.wendao.poker';
const runner = appId + '.test/androidx.test.runner.AndroidJUnitRunner';
let serial, log = '';
function command(args, allowMissingProcess = false) {
  const result = spawnSync(adb, [...(serial ? ['-s', serial] : []), ...args], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  log += `$ adb ${args.join(' ')}\n${result.stdout || ''}${result.stderr || ''}\n`;
  if (result.error) throw result.error;
  if (result.status !== 0 && !(allowMissingProcess && result.status === 1 && !result.stderr?.trim()))
    throw new Error(`adb command failed: ${args.join(' ')}\n${result.stdout}${result.stderr}`);
  return result.stdout.trim();
}
function pid() { return command(['shell', 'pidof', appId], true); }
async function until(predicate, label) {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + label);
}
function instrument(method, phase) {
  const text = command(['shell', 'am', 'instrument', '-w', '-r', '-e', 'class',
    `${appId}.PracticeInstrumentedTest#${method}`, '-e', 'phase', phase, runner]);
  assert.match(text, /OK \(1 test\)/, 'Instrumentation must explicitly report one passing test');
  assert.doesNotMatch(text, /FAILURES!!!|INSTRUMENTATION_FAILED|shortMsg=/);
  assert.doesNotMatch(text, /INSTRUMENTATION_STATUS_CODE:\s*-\d+/, 'Neither phase may pass by skipping or failing its selected method');
}
try {
  serial = isolatedEmulator(command(['devices']), process.env.ANDROID_SERIAL);
  assert.equal(command(['shell', 'getprop', 'ro.kernel.qemu']), '1', 'An emulator must be independently verified before installing test fixtures');
  for (const apk of ['android/app/build/outputs/apk/debug/app-debug.apk', 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk']) {
    assert.ok(existsSync(apk), 'Build Android and instrumentation APKs first: ' + apk);
    command(['install', '-r', resolve(apk)]);
  }
  instrument('prepareForHostProcessDeath', 'prepare-process-death');
  command(['shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity']);
  await until(() => !!pid(), 'test app has a live process');
  const before = pid();
  command(['shell', 'am', 'force-stop', appId]);
  await until(() => !pid(), 'target app process has actually disappeared');
  command(['shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity']);
  await until(() => !!pid(), 'target app restarts');
  const after = pid();
  assert.notEqual(after, before, 'The restarted app must be a new process');
  instrument('restoreAfterHostProcessDeath', 'restore-process-death');
  const result = { passed: true, environment: 'Android emulator', sdk: command(['shell', 'getprop', 'ro.build.version.sdk']), processBefore: before, processAfter: after,
    checks: ['real process disappears after force-stop', 'new process starts', 'same hand and wallet', 'same course progress', 'trial seal hydrated from Preferences', 'beginner step hydrated from Preferences'],
    notVerified: ['physical phone', 'low-memory killer', 'hardware audio', 'sustained frame times'] };
  writeFileSync(join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log('Android process-death recovery passed: ' + before + ' → stopped → ' + after);
} catch (error) {
  writeFileSync(join(output, 'result.json'), JSON.stringify({ passed: false, error: error.message }, null, 2));
  throw error;
} finally { writeFileSync(join(output, 'adb.log'), log); }
