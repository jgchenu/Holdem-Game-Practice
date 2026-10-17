import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isolatedEmulator } from '../../scripts/android-test-device.mjs';

test('原生隔离测试预检拒绝真机、混合连接及多台设备，防止 Gradle 安装测试夹具', () => {
  assert.equal(isolatedEmulator('List of devices attached\nemulator-5554\tdevice\n'), 'emulator-5554');
  for (const listing of [
    'List of devices attached\n',
    'List of devices attached\nphone-1\tdevice\n',
    'List of devices attached\nemulator-5554\tdevice\nphone-1\tdevice\n',
    'List of devices attached\nemulator-5554\toffline\n',
    'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n',
  ]) assert.throws(() => isolatedEmulator(listing));
  assert.throws(() => isolatedEmulator('List of devices attached\nemulator-5554\tdevice\n', 'phone-1'));
});
