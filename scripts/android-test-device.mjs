/** Gradle's connected test task may install on every connected device, so require one isolated emulator. */
export function isolatedEmulator(listing, requested) {
  const devices = listing.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('List of devices attached'))
    .map(line => line.split(/\s+/));
  if (devices.length !== 1 || devices[0][1] !== 'device' || !/^emulator-\d+$/.test(devices[0][0]))
    throw new Error('隔离测试需要仅连接一台 Android 模拟器；请先断开真机，测试会写入专用练习数据。');
  if (requested && requested !== devices[0][0]) throw new Error('ANDROID_SERIAL 与唯一测试模拟器不一致。');
  return devices[0][0];
}
