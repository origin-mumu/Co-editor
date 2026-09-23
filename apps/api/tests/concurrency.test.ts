import { WebSocket } from 'ws';
import { WSAction, type WSEnvelope, type AckPayload, type RejectPayload, type InitStatePayload } from '@co-editor/shared';
import { WSServer } from '../src/wsServer.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = 8089;
const TEST_DIR = path.resolve(__dirname, './temp-data');

async function runTest() {
  console.log('🧪 开始并发冲突仲裁与幂等防重自动化测试...\n');

  const server = new WSServer(TEST_PORT, TEST_DIR);
  const docId = 'test-doc-' + Date.now();

  const wsA = new WebSocket(`ws://localhost:${TEST_PORT}`);
  const wsB = new WebSocket(`ws://localhost:${TEST_PORT}`);

  const waitForOpen = (ws: WebSocket) => new Promise<void>((res) => ws.on('open', () => res()));
  await Promise.all([waitForOpen(wsA), waitForOpen(wsB)]);

  let targetBlockId = '';

  // 1. Client A 加入房间获取初始快照
  const aInitPromise = new Promise<void>((resolve) => {
    wsA.on('message', (raw) => {
      const msg: WSEnvelope = JSON.parse(raw.toString());
      if (msg.action === WSAction.INIT_STATE) {
        const payload = msg.payload as InitStatePayload;
        targetBlockId = payload.document.blocks[0].id;
        resolve();
      }
    });
  });

  wsA.send(JSON.stringify({
    action: WSAction.JOIN_ROOM,
    docId,
    clientId: 'client-A',
    timestamp: Date.now(),
    payload: { username: 'Client A' }
  }));

  wsB.send(JSON.stringify({
    action: WSAction.JOIN_ROOM,
    docId,
    clientId: 'client-B',
    timestamp: Date.now(),
    payload: { username: 'Client B' }
  }));

  await aInitPromise;
  console.log('✅ 房间初始化完成，目标 Block ID = %s', targetBlockId);

  // 2. Client A 和 Client B 同时发起基于 baseVersion=1 的修改
  console.log('⚡ 触发并发测试：Client A 与 Client B 同时修改同一个 Block (baseVersion=1)...');

  let ackCount = 0;
  let rejectCount = 0;

  const responses = new Promise<void>((resolve) => {
    const handleMsg = (raw: any) => {
      const msg: WSEnvelope = JSON.parse(raw.toString());
      if (msg.action === WSAction.ACK_TX) {
        ackCount++;
        const ack = msg.payload as AckPayload;
        console.log('   [PASS] 收到 ACK_TX: txId = %s, version = %d', ack.txId, ack.newVersion);
      }
      if (msg.action === WSAction.REJECT_TX) {
        rejectCount++;
        const rej = msg.payload as RejectPayload;
        console.log('   [PASS] 收到 REJECT_TX: txId = %s, reason = %s', rej.txId, rej.reason);
      }
      if (ackCount + rejectCount === 2) {
        resolve();
      }
    };
    wsA.on('message', handleMsg);
    wsB.on('message', handleMsg);
  });

  const txIdA = 'tx-A-101';
  const txIdB = 'tx-B-102';

  wsA.send(JSON.stringify({
    action: WSAction.APPLY_TX,
    docId,
    clientId: 'client-A',
    timestamp: Date.now(),
    payload: {
      txId: txIdA,
      opType: 'UPDATE_BLOCK',
      blockId: targetBlockId,
      baseVersion: 1,
      content: 'A 修改的内容'
    }
  }));

  wsB.send(JSON.stringify({
    action: WSAction.APPLY_TX,
    docId,
    clientId: 'client-B',
    timestamp: Date.now(),
    payload: {
      txId: txIdB,
      opType: 'UPDATE_BLOCK',
      blockId: targetBlockId,
      baseVersion: 1,
      content: 'B 修改的内容'
    }
  }));

  await responses;

  if (ackCount === 1 && rejectCount === 1) {
    console.log('\n🎉 CAS 并发冲突仲裁验证通过：精准产生 1 个 ACK 和 1 个 REJECT！');
  } else {
    throw new Error(`CAS 仲裁异常: ACK=${ackCount}, REJECT=${rejectCount}`);
  }

  // 3. 幂等防重测试：再次发送 txIdA
  console.log('\n⚡ 触发幂等测试：重复重发相同 txId (tx-A-101)...');
  const idemPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('幂等测试超时未收到响应')), 3000);
    wsA.once('message', (raw) => {
      clearTimeout(timeout);
      const msg: WSEnvelope = JSON.parse(raw.toString());
      if (msg.action === WSAction.ACK_TX) {
        const ack = msg.payload as AckPayload;
        if (ack.txId === txIdA) {
          console.log('   [PASS] 幂等成功响应缓存 ACK: txId = %s', ack.txId);
          resolve();
        }
      }
    });
  });

  wsA.send(JSON.stringify({
    action: WSAction.APPLY_TX,
    docId,
    clientId: 'client-A',
    timestamp: Date.now(),
    payload: {
      txId: txIdA,
      opType: 'UPDATE_BLOCK',
      blockId: targetBlockId,
      baseVersion: 1,
      content: 'A 尝试重复覆盖'
    }
  }));

  await idemPromise;
  console.log('🎉 幂等去重验证通过：重复事务直接命中缓存并返回 ACK，未执行重复更新！\n');

  wsA.close();
  wsB.close();
  await server.close();
  console.log('✅ 测试全部顺利通过！');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
