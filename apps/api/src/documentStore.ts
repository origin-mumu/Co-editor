import fs from 'node:fs';
import path from 'node:path';
import type { Block, DocumentState, TxPayload } from '@co-editor/shared';
import { nanoid } from 'nanoid';

export type TxApplyResult =
  | { success: true; block: Block; docVersion: number; targetIndex?: number }
  | {
      success: false;
      reason: 'VERSION_CONFLICT' | 'BLOCK_NOT_FOUND' | 'INVALID_OP';
      currentVersion?: number;
      latestBlock?: Block;
    };

/**
 * 内存文档存储与 CAS 仲裁引擎
 */
export class DocumentStore {
  private doc: DocumentState;
  private readonly snapshotPath?: string;

  constructor(docId: string, snapshotDir?: string) {
    if (snapshotDir) {
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }
      this.snapshotPath = path.join(snapshotDir, `${docId}.json`);
    }

    // 优先尝试从快照恢复，否则初始化默认文档
    const restored = this.tryRestoreSnapshot();
    if (restored) {
      this.doc = restored;
    } else {
      const now = Date.now();
      const initialBlock: Block = {
        id: `block-${nanoid(8)}`,
        type: 'paragraph',
        content: '欢迎使用 Co-editor 协同编辑器！开始输入以体验毫秒级协同...',
        version: 1,
        updatedAt: now,
        updatedBy: 'system'
      };

      this.doc = {
        docId,
        version: 1,
        blocks: [initialBlock],
        createdAt: now,
        updatedAt: now
      };
    }
  }

  /**
   * 同步原子执行事务 (CAS 乐观并发控制)
   */
  public applyTransaction(tx: TxPayload, originClientId: string): TxApplyResult {
    const now = Date.now();

    // 1. 更新块内容
    if (tx.opType === 'UPDATE_BLOCK') {
      const block = this.doc.blocks.find(b => b.id === tx.blockId);
      if (!block) {
        return { success: false, reason: 'BLOCK_NOT_FOUND' };
      }

      // 核心 CAS 版本检验
      if (block.version !== tx.baseVersion) {
        return {
          success: false,
          reason: 'VERSION_CONFLICT',
          currentVersion: block.version,
          latestBlock: { ...block }
        };
      }

      // 版本一致，原子递增并写入
      if (tx.content !== undefined) block.content = tx.content;
      if (tx.blockType !== undefined) block.type = tx.blockType;
      block.version += 1;
      block.updatedAt = now;
      block.updatedBy = originClientId;

      this.doc.version += 1;
      this.doc.updatedAt = now;
      this.autoSave();

      return {
        success: true,
        block: { ...block },
        docVersion: this.doc.version
      };
    }

    // 2. 插入新块
    if (tx.opType === 'INSERT_BLOCK') {
      const newBlock: Block = {
        id: tx.blockId || `block-${nanoid(8)}`,
        type: tx.blockType || 'paragraph',
        content: tx.content || '',
        version: 1,
        updatedAt: now,
        updatedBy: originClientId
      };

      let insertIdx = this.doc.blocks.length;
      if (tx.prevBlockId) {
        const prevIdx = this.doc.blocks.findIndex(b => b.id === tx.prevBlockId);
        if (prevIdx !== -1) insertIdx = prevIdx + 1;
      } else if (tx.targetIndex !== undefined) {
        insertIdx = Math.min(Math.max(0, tx.targetIndex), this.doc.blocks.length);
      }

      this.doc.blocks.splice(insertIdx, 0, newBlock);
      this.doc.version += 1;
      this.doc.updatedAt = now;
      this.autoSave();

      return {
        success: true,
        block: { ...newBlock },
        docVersion: this.doc.version,
        targetIndex: insertIdx
      };
    }

    // 3. 删除块
    if (tx.opType === 'DELETE_BLOCK') {
      const blockIndex = this.doc.blocks.findIndex(b => b.id === tx.blockId);
      if (blockIndex === -1) {
        return { success: false, reason: 'BLOCK_NOT_FOUND' };
      }

      // 保留至少一个 Block
      if (this.doc.blocks.length <= 1) {
        const target = this.doc.blocks[0];
        target.content = '';
        target.version += 1;
        target.updatedAt = now;
        target.updatedBy = originClientId;
        this.doc.version += 1;
        this.autoSave();
        return { success: true, block: { ...target }, docVersion: this.doc.version };
      }

      const [deleted] = this.doc.blocks.splice(blockIndex, 1);
      this.doc.version += 1;
      this.doc.updatedAt = now;
      this.autoSave();

      return {
        success: true,
        block: deleted,
        docVersion: this.doc.version,
        targetIndex: blockIndex
      };
    }

    return { success: false, reason: 'INVALID_OP' };
  }

  /**
   * 获取当前完整快照
   */
  public getSnapshot(): DocumentState {
    return JSON.parse(JSON.stringify(this.doc));
  }

  /**
   * 尝试从磁盘加载 JSON 快照
   */
  private tryRestoreSnapshot(): DocumentState | null {
    if (!this.snapshotPath || !fs.existsSync(this.snapshotPath)) return null;
    try {
      const raw = fs.readFileSync(this.snapshotPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * 自动写盘 (可节流)
   */
  private autoSave(): void {
    if (!this.snapshotPath) return;
    try {
      fs.writeFileSync(this.snapshotPath, JSON.stringify(this.doc, null, 2), 'utf-8');
    } catch (err) {
      console.error('[STORE:SAVE_FAIL]', err);
    }
  }
}
