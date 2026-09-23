import type { WebSocket } from 'ws';
import type { WSEnvelope } from '@co-editor/shared';
import { DocumentStore } from './documentStore.js';
import { PresenceManager } from './presence.js';
import { IdempotencyManager } from './idempotency.js';

export interface Room {
  docId: string;
  store: DocumentStore;
  presence: PresenceManager;
  idempotency: IdempotencyManager;
  clients: Map<string, WebSocket>;
}

/**
 * 多房间调度管理器
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private clientToRoom = new Map<string, string>();
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * 获取或初始化房间
   */
  public getOrCreateRoom(docId: string): Room {
    let room = this.rooms.get(docId);
    if (!room) {
      room = {
        docId,
        store: new DocumentStore(docId, this.dataDir),
        presence: new PresenceManager(),
        idempotency: new IdempotencyManager(),
        clients: new Map()
      };
      this.rooms.set(docId, room);
    }
    return room;
  }

  /**
   * 将客户端加入房间
   */
  public join(docId: string, clientId: string, ws: WebSocket, username?: string): Room {
    const room = this.getOrCreateRoom(docId);
    room.clients.set(clientId, ws);
    this.clientToRoom.set(clientId, docId);
    room.presence.join(clientId, username);
    return room;
  }

  /**
   * 客户端断开/离开
   */
  public leave(clientId: string): { room: Room; clientId: string } | null {
    const docId = this.clientToRoom.get(clientId);
    if (!docId) return null;

    this.clientToRoom.delete(clientId);
    const room = this.rooms.get(docId);
    if (!room) return null;

    room.clients.delete(clientId);
    room.presence.leave(clientId);

    return { room, clientId };
  }

  /**
   * 向房间内广播消息
   */
  public broadcast<T>(docId: string, envelope: WSEnvelope<T>, excludeClientId?: string): void {
    const room = this.rooms.get(docId);
    if (!room) return;

    const raw = JSON.stringify(envelope);
    for (const [clientId, ws] of room.clients.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;
      if (ws.readyState === ws.OPEN) {
        ws.send(raw);
      }
    }
  }

  /**
   * 查询客户端所在房间
   */
  public getRoomByClientId(clientId: string): Room | null {
    const docId = this.clientToRoom.get(clientId);
    return docId ? this.rooms.get(docId) ?? null : null;
  }
}
