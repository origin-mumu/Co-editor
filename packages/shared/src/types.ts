/**
 * 块样式类型
 */
export type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'todo';

/**
 * 单个 Block 数据模型
 */
export interface Block {
  id: string;
  type: BlockType;
  content: string;
  version: number;
  updatedAt: number;
  updatedBy: string;
}

/**
 * 整个文档状态数据模型
 */
export interface DocumentState {
  docId: string;
  version: number;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 在线协作者状态
 */
export interface UserPresence {
  clientId: string;
  username: string;
  color: string;
  activeBlockId: string | null;
  cursorOffset: number;
  lastSeen: number;
}

/**
 * 事务执行结果
 */
export interface TxExecutionResult {
  txId: string;
  success: boolean;
  resultingVersion: number;
  reason?: string;
  timestamp: number;
}
