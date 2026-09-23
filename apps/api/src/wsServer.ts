import { WebSocketServer, type WebSocket } from 'ws';
import {
  WSAction,
  isWSEnvelope,
  isTxPayload,
  type WSEnvelope,
  type TxPayload,
  type AckPayload,
  type RejectPayload,
  type BroadcastOpPayload,
  type SyncRequestPayload,
  type SyncResponsePayload,
  type InitStatePayload,
  type UserPresence
} from '@co-editor/shared';
import { RoomManager } from './roomManager.js';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  clientId?: string;
  docId?: string;
}

export class WSServer {
  private wss: WebSocketServer;
  private roomManager: RoomManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number, dataDir: string) {
    this.roomManager = new RoomManager(dataDir);
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: ExtendedWebSocket) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data: Buffer | string) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.handleClose(ws);
      });

      ws.on('error', (err) => {
        console.error('[WS:ERROR]', err);
      });
    });

    // 30秒服务端定时心跳巡检
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.wss.clients) {
        const extWs = client as ExtendedWebSocket;
        if (!extWs.isAlive) {
          extWs.terminate();
          continue;
        }
        extWs.isAlive = false;
        extWs.ping();
      }
    }, 30000);

    console.log(`[WS:READY] Co-editor server listening on ws://localhost:${port}`);
  }

  /**
   * 消息分发核心
   */
  private handleMessage(ws: ExtendedWebSocket, raw: string): void {
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isWSEnvelope(envelope)) return;

    const { action, docId, clientId, payload } = envelope;

    // 1. 加入房间与初始化状态
    if (action === WSAction.JOIN_ROOM) {
      ws.clientId = clientId;
      ws.docId = docId;

      const username = typeof payload === 'object' && payload !== null && 'username' in payload
        ? String((payload as Record<string, unknown>).username)
        : undefined;

      const room = this.roomManager.join(docId, clientId, ws, username);
      console.log('[WS:JOIN] Client %s joined doc %s', clientId, docId);

      // 发送完整初始快照给该客户端
      const initPayload: InitStatePayload = {
        document: room.store.getSnapshot(),
        presences: room.presence.getActiveUsers()
      };
      this.send(ws, {
        action: WSAction.INIT_STATE,
        docId,
        clientId: 'server',
        timestamp: Date.now(),
        payload: initPayload
      });

      // 向房间其他人广播在线协作者变动
      this.broadcastPresences(docId);
      return;
    }

    const room = this.roomManager.getOrCreateRoom(docId);

    // 2. 提交事务 (APPLY_TX)
    if (action === WSAction.APPLY_TX) {
      if (!isTxPayload(payload)) return;
      const tx = payload as TxPayload;

      // 幂等防重：检查是否为重复重试包
      if (room.idempotency.has(tx.txId)) {
        console.info('[IDEM:HIT] Duplicate txId ignored: %s', tx.txId);
        const cached = room.idempotency.get(tx.txId)!;
        const ackPayload: AckPayload = {
          txId: tx.txId,
          blockId: tx.blockId,
          newVersion: cached.resultingVersion,
          docVersion: room.store.getSnapshot().version,
          success: true
        };
        this.send(ws, {
          action: WSAction.ACK_TX,
          docId,
          clientId: 'server',
          timestamp: Date.now(),
          payload: ackPayload
        });
        return;
      }

      // 执行 CAS 仲裁
      const result = room.store.applyTransaction(tx, clientId);

      if (result.success) {
        // 记录幂等缓存
        room.idempotency.record(tx.txId, result.block.version);
        console.log(
          '[CAS:APPLY] Tx %s applied! block=%s, ver=%d, docVer=%d',
          tx.txId,
          tx.blockId,
          result.block.version,
          result.docVersion
        );

        // 返回成功 ACK 给发送者
        const ackPayload: AckPayload = {
          txId: tx.txId,
          blockId: tx.blockId,
          newVersion: result.block.version,
          docVersion: result.docVersion,
          success: true
        };
        this.send(ws, {
          action: WSAction.ACK_TX,
          docId,
          clientId: 'server',
          timestamp: Date.now(),
          payload: ackPayload
        });

        // 向房间内其他协作者广播增量操作
        const broadcastPayload: BroadcastOpPayload = {
          opType: tx.opType,
          block: result.block,
          targetIndex: result.targetIndex,
          docVersion: result.docVersion,
          originClientId: clientId
        };
        this.roomManager.broadcast(
          docId,
          {
            action: WSAction.BROADCAST_OP,
            docId,
            clientId: 'server',
            timestamp: Date.now(),
            payload: broadcastPayload
          },
          clientId
        );
      } else {
        // 冲突或无效操作：触发拒绝
        console.warn(
          '[CAS:CONFLICT] Tx %s rejected! reason=%s, baseVer=%d',
          tx.txId,
          result.reason,
          tx.baseVersion
        );
        const rejectPayload: RejectPayload = {
          txId: tx.txId,
          blockId: tx.blockId,
          reason: result.reason,
          currentVersion: result.currentVersion,
          latestBlock: result.latestBlock
        };
        this.send(ws, {
          action: WSAction.REJECT_TX,
          docId,
          clientId: 'server',
          timestamp: Date.now(),
          payload: rejectPayload
        });
      }
      return;
    }

    // 3. 协作者状态与光标更新 (PRESENCE_UPDATE)
    if (action === WSAction.PRESENCE_UPDATE) {
      if (typeof payload === 'object' && payload !== null) {
        room.presence.update(clientId, payload as Partial<UserPresence>);
        this.broadcastPresences(docId);
      }
      return;
    }

    // 4. 重连对齐同步 (SYNC_REQUEST)
    if (action === WSAction.SYNC_REQUEST) {
      const clientDocVer = (payload as SyncRequestPayload)?.docVersion ?? 0;
      const currentDoc = room.store.getSnapshot();

      const syncPayload: SyncResponsePayload =
        clientDocVer >= currentDoc.version
          ? { type: 'UP_TO_DATE' }
          : { type: 'FULL_SNAPSHOT', snapshot: currentDoc };

      this.send(ws, {
        action: WSAction.SYNC_RESPONSE,
        docId,
        clientId: 'server',
        timestamp: Date.now(),
        payload: syncPayload
      });
      return;
    }

    // 5. 心跳保活 (PING)
    if (action === WSAction.PING) {
      this.send(ws, {
        action: WSAction.PONG,
        docId,
        clientId: 'server',
        timestamp: Date.now(),
        payload: {}
      });
    }
  }

  /**
   * 广播在线协作者列表
   */
  private broadcastPresences(docId: string): void {
    const room = this.roomManager.getOrCreateRoom(docId);
    this.roomManager.broadcast(docId, {
      action: WSAction.PRESENCE_BROADCAST,
      docId,
      clientId: 'server',
      timestamp: Date.now(),
      payload: room.presence.getActiveUsers()
    });
  }

  /**
   * 单发消息辅助方法
   */
  private send<T>(ws: WebSocket, envelope: WSEnvelope<T>): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }

  /**
   * 客户端断开清理
   */
  private handleClose(ws: ExtendedWebSocket): void {
    if (ws.clientId) {
      console.log('[WS:LEAVE] Client %s left', ws.clientId);
      const leaveRes = this.roomManager.leave(ws.clientId);
      if (leaveRes) {
        this.broadcastPresences(leaveRes.room.docId);
      }
    }
  }

  /**
   * 优雅关停
   */
  public close(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
