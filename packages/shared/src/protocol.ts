import type { Block, BlockType, DocumentState, UserPresence } from './types.js';

/**
 * WebSocket 通信动作枚举
 */
export enum WSAction {
  // 连接与握手
  JOIN_ROOM = 'JOIN_ROOM',
  INIT_STATE = 'INIT_STATE',

  // 事务与状态同步
  APPLY_TX = 'APPLY_TX',
  ACK_TX = 'ACK_TX',
  REJECT_TX = 'REJECT_TX',
  BROADCAST_OP = 'BROADCAST_OP',

  // 协同感知 (Presence)
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',
  PRESENCE_BROADCAST = 'PRESENCE_BROADCAST',

  // 断网自愈与差异对齐
  SYNC_REQUEST = 'SYNC_REQUEST',
  SYNC_RESPONSE = 'SYNC_RESPONSE',

  // 心跳保活
  PING = 'PING',
  PONG = 'PONG'
}

/**
 * 基础报文封装 (Envelope)
 */
export interface WSEnvelope<T = unknown> {
  action: WSAction;
  docId: string;
  clientId: string;
  timestamp: number;
  payload: T;
}

/**
 * 事务操作类型
 */
export type TxOpType = 'UPDATE_BLOCK' | 'INSERT_BLOCK' | 'DELETE_BLOCK';

/**
 * 客户端提交事务载荷
 */
export interface TxPayload {
  txId: string;
  opType: TxOpType;
  blockId: string;
  baseVersion: number;
  content?: string;
  blockType?: BlockType;
  targetIndex?: number;
  prevBlockId?: string;
}

/**
 * 服务端确认成功载荷
 */
export interface AckPayload {
  txId: string;
  blockId: string;
  newVersion: number;
  docVersion: number;
  success: true;
}

/**
 * 服务端拒绝事务载荷 (版本冲突/找不到块)
 */
export interface RejectPayload {
  txId: string;
  blockId: string;
  reason: 'VERSION_CONFLICT' | 'BLOCK_NOT_FOUND' | 'INVALID_OP';
  currentVersion?: number;
  latestBlock?: Block;
}

/**
 * 增量广播载荷
 */
export interface BroadcastOpPayload {
  opType: TxOpType;
  block: Block;
  targetIndex?: number;
  docVersion: number;
  originClientId: string;
}

/**
 * 对齐请求载荷
 */
export interface SyncRequestPayload {
  docVersion: number;
}

/**
 * 对齐响应载荷
 */
export interface SyncResponsePayload {
  type: 'UP_TO_DATE' | 'FULL_SNAPSHOT';
  snapshot?: DocumentState;
}

/**
 * 房间初始化状态载荷
 */
export interface InitStatePayload {
  document: DocumentState;
  presences: UserPresence[];
}

/**
 * 类型守卫：验证是否为合法的 WSEnvelope 结构
 */
export function isWSEnvelope(data: unknown): data is WSEnvelope {
  if (typeof data !== 'object' || data === null) return false;
  const env = data as Record<string, unknown>;
  return (
    typeof env.action === 'string' &&
    typeof env.docId === 'string' &&
    typeof env.clientId === 'string' &&
    typeof env.timestamp === 'number' &&
    'payload' in env
  );
}

/**
 * 类型守卫：验证是否为合法的 TxPayload 结构
 */
export function isTxPayload(payload: unknown): payload is TxPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const tx = payload as Record<string, unknown>;
  return (
    typeof tx.txId === 'string' &&
    typeof tx.opType === 'string' &&
    typeof tx.blockId === 'string' &&
    typeof tx.baseVersion === 'number'
  );
}
