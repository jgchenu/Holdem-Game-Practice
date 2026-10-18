// Project-owned native network fixture. No provider settings or .env are read.
// Requests still traverse the real HTTP gateway and a real loopback upstream.
import { createServer } from 'node:http';
import { tsImport } from 'tsx/esm/api';

export const fixtureOrigins = ['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'];
export const fixtureLabel = '兼容接口验收替身（非真实模型）';

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

export async function startCoachFixture({ port = 0, timeoutMs = 500 } = {}) {
  const { createCoachServer } = await tsImport('../server/coach-server.ts', import.meta.url);
  const gatewayRequests = [], upstreamRequests = [];
  let nextMode = 'success';
  const upstream = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const facts = JSON.parse(payload.messages[1].content);
      const mode = nextMode; nextMode = 'success';
      const record = { mode, path: req.url, model: payload.model, facts: facts.facts,
        serverCredentialPresent: req.headers.authorization === 'Bearer fixture-server-only',
        playersHaveNoPrivateCards: facts.players.every(p => !('hole' in p)), disconnected: false };
      upstreamRequests.push(record);
      res.once('close', () => { if (!res.writableEnded) record.disconnected = true; });
      if (req.url !== '/chat/completions' || payload.model !== 'fixture-model' || !record.serverCredentialPresent) {
        res.writeHead(400); res.end(); return;
      }
      if (mode === 'timeout') return; // The real gateway must abort this socket.
      if (mode === 'error') { res.writeHead(503); res.end('fixture upstream unavailable'); return; }
      if (mode === 'stream-error') { res.writeHead(503); res.write('fixture error body still streaming'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: `${fixtureLabel}：本轮跟注需 ${facts.facts.call} 灵石。这是网络链路测试，不是模型建议。` } }] }));
    } catch {
      if (!res.destroyed) { res.writeHead(400); res.end(); }
    }
  });
  const baseUrl = await listen(upstream, 0);
  const gateway = createCoachServer({ baseUrl, model: 'fixture-model', apiKey: 'fixture-server-only', origins: fixtureOrigins, timeoutMs });
  gateway.on('request', (req, res) => {
    const record = { method: req.method, path: req.url, origin: req.headers.origin ?? null, status: null };
    gatewayRequests.push(record);
    res.once('finish', () => { record.status = res.statusCode; });
  });
  try {
    const gatewayUrl = await listen(gateway, port);
    return {
      url: gatewayUrl + '/api/coach', label: fixtureLabel,
      setNextMode(mode) {
        if (!['success','error','stream-error','timeout'].includes(mode)) throw Error('Unknown fixture mode');
        nextMode = mode;
      },
      report() { return structuredClone({ scope: 'Real loopback HTTP gateway and compatible upstream fixture; not a real model', gatewayRequests, upstreamRequests }); },
      async close() { await close(gateway); await close(upstream); },
    };
  } catch (error) { await close(upstream); throw error; }
}
