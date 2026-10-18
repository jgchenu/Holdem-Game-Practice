import assert from 'node:assert/strict';

/** Android log lines are bounded: reconstruct byte chunks before decoding UTF-8. */
export function parseAndroidAudit(lines) {
  const records = lines.filter(line => line.includes('Native runtime audit part '));
  if (!records.length) {
    const legacy = lines.filter(line => line.includes('Native runtime audit: '));
    assert.equal(legacy.length, 1, 'Exactly one legacy audit report required');
    return JSON.parse(legacy[0].split('Native runtime audit: ')[1]);
  }
  let total; const parts = new Map();
  for (const line of records) {
    const match = line.match(/Native runtime audit part (\d+)\/(\d+): ([A-Za-z0-9+/=]+)\s*$/);
    assert.ok(match, 'Malformed audit chunk');
    const index = Number(match[1]), count = Number(match[2]);
    assert.ok(count > 0 && count <= 4096 && index > 0 && index <= count, 'Invalid chunk bounds');
    total ??= count; assert.equal(count, total, 'Mixed chunk totals');
    assert.ok(!parts.has(index), 'Duplicate audit chunk');
    const bytes = Buffer.from(match[3], 'base64');
    assert.equal(bytes.toString('base64'), match[3], 'Invalid base64 chunk');
    parts.set(index, bytes);
  }
  assert.equal(parts.size, total, 'Missing audit chunks');
  return JSON.parse(Buffer.concat(Array.from({length:total}, (_, i) => parts.get(i + 1))).toString('utf8'));
}
