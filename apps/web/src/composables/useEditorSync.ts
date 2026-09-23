import { useState, useCallback, useRef } from 'react';
import {
  WSAction,
  type Block,
  type DocumentState,
  type TxPayload,
  type AckPayload,
  type RejectPayload,
  type BroadcastOpPayload,
  type InitStatePayload,
  type SyncResponsePayload,
  type WSEnvelope
} from '@co-editor/shared';
import { nanoid } from 'nanoid';

interface UseEditorSyncOptions {
  clientId: string;
  docId: string;
  send: <T>(action: WSAction, payload: T) => boolean;
  onConflictNotice?: (msg: string) => void;
}

export function useEditorSync({ clientId, docId, send, onConflictNotice }: UseEditorSyncOptions) {
  const [doc, setDoc] = useState<DocumentState>({
    docId,
    version: 1,
    blocks: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const [conflictToast, setConflictToast] = useState<string | null>(null);

  // 未确认事务队列 (Pending Queue)
  const pendingQueueRef = useRef<Map<string, TxPayload>>(new Map());

  // 1. 本地用户修改块内容 (乐观更新)
  const updateBlockContent = useCallback(
    (blockId: string, newContent: string) => {
      let currentVersion = 1;

      setDoc((prev) => {
        const blocks = prev.blocks.map((b) => {
          if (b.id === blockId) {
            currentVersion = b.version;
            return { ...b, content: newContent, updatedAt: Date.now(), updatedBy: clientId };
          }
          return b;
        });
        return { ...prev, blocks, updatedAt: Date.now() };
      });

      const tx: TxPayload = {
        txId: `tx-${clientId.slice(-4)}-${nanoid(6)}`,
        opType: 'UPDATE_BLOCK',
        blockId,
        baseVersion: currentVersion,
        content: newContent
      };

      pendingQueueRef.current.set(tx.txId, tx);
      send(WSAction.APPLY_TX, tx);
    },
    [clientId, send]
  );

  // 2. 本地用户按下 Enter 新增块 (乐观插入)
  const insertBlockAfter = useCallback(
    (prevBlockId: string) => {
      const newBlockId = `block-${nanoid(8)}`;
      const newBlock: Block = {
        id: newBlockId,
        type: 'paragraph',
        content: '',
        version: 1,
        updatedAt: Date.now(),
        updatedBy: clientId
      };

      setDoc((prev) => {
        const idx = prev.blocks.findIndex((b) => b.id === prevBlockId);
        const insertAt = idx === -1 ? prev.blocks.length : idx + 1;
        const newBlocks = [...prev.blocks];
        newBlocks.splice(insertAt, 0, newBlock);
        return { ...prev, blocks: newBlocks, updatedAt: Date.now() };
      });

      const tx: TxPayload = {
        txId: `tx-${clientId.slice(-4)}-${nanoid(6)}`,
        opType: 'INSERT_BLOCK',
        blockId: newBlockId,
        baseVersion: 1,
        prevBlockId,
        content: ''
      };

      pendingQueueRef.current.set(tx.txId, tx);
      send(WSAction.APPLY_TX, tx);
      return newBlockId;
    },
    [clientId, send]
  );

  // 3. 本地用户删除块 (退格合并)
  const deleteBlock = useCallback(
    (blockId: string) => {
      let baseVersion = 1;

      setDoc((prev) => {
        if (prev.blocks.length <= 1) return prev; // 至少保留一个
        const target = prev.blocks.find((b) => b.id === blockId);
        if (target) baseVersion = target.version;
        return {
          ...prev,
          blocks: prev.blocks.filter((b) => b.id !== blockId),
          updatedAt: Date.now()
        };
      });

      const tx: TxPayload = {
        txId: `tx-${clientId.slice(-4)}-${nanoid(6)}`,
        opType: 'DELETE_BLOCK',
        blockId,
        baseVersion
      };

      pendingQueueRef.current.set(tx.txId, tx);
      send(WSAction.APPLY_TX, tx);
    },
    [clientId, send]
  );

  // 处理消息分发
  const handleServerMessage = useCallback(
    (envelope: WSEnvelope) => {
      const { action, payload } = envelope;

      // ① 初始全量快照
      if (action === WSAction.INIT_STATE) {
        const initData = payload as InitStatePayload;
        setDoc(initData.document);
        pendingQueueRef.current.clear();
        return;
      }

      // ② 事务成功确认 (ACK_TX)
      if (action === WSAction.ACK_TX) {
        const ack = payload as AckPayload;
        pendingQueueRef.current.delete(ack.txId);
        // 更新本地块的已确认版本
        setDoc((prev) => ({
          ...prev,
          version: ack.docVersion,
          blocks: prev.blocks.map((b) =>
            b.id === ack.blockId ? { ...b, version: ack.newVersion } : b
          )
        }));
        return;
      }

      // ③ 事务冲突被拒绝 (REJECT_TX)
      if (action === WSAction.REJECT_TX) {
        const rej = payload as RejectPayload;
        pendingQueueRef.current.delete(rej.txId);

        const notice = '检测到并发编辑冲突：已被其他协作者先行提交，正在为您自动对齐最新状态...';
        setConflictToast(notice);
        setTimeout(() => setConflictToast(null), 4000);
        if (onConflictNotice) onConflictNotice(notice);

        // 如果服务端带回了最新块，回滚覆盖该块
        if (rej.latestBlock) {
          setDoc((prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) => (b.id === rej.blockId ? rej.latestBlock! : b))
          }));
        }
        return;
      }

      // ④ 协作者增量广播 (BROADCAST_OP)
      if (action === WSAction.BROADCAST_OP) {
        const op = payload as BroadcastOpPayload;
        setDoc((prev) => {
          let updatedBlocks = [...prev.blocks];

          if (op.opType === 'UPDATE_BLOCK') {
            const exists = updatedBlocks.some((b) => b.id === op.block.id);
            if (exists) {
              updatedBlocks = updatedBlocks.map((b) => (b.id === op.block.id ? op.block : b));
            } else {
              updatedBlocks.push(op.block);
            }
          } else if (op.opType === 'INSERT_BLOCK') {
            const idx = op.targetIndex !== undefined ? op.targetIndex : updatedBlocks.length;
            const alreadyIn = updatedBlocks.some((b) => b.id === op.block.id);
            if (!alreadyIn) {
              updatedBlocks.splice(idx, 0, op.block);
            }
          } else if (op.opType === 'DELETE_BLOCK') {
            updatedBlocks = updatedBlocks.filter((b) => b.id === op.block.id);
          }

          return { ...prev, version: op.docVersion, blocks: updatedBlocks, updatedAt: Date.now() };
        });
        return;
      }

      // ⑤ 断网对齐响应 (SYNC_RESPONSE)
      if (action === WSAction.SYNC_RESPONSE) {
        const sync = payload as SyncResponsePayload;
        if (sync.type === 'FULL_SNAPSHOT' && sync.snapshot) {
          setDoc(sync.snapshot);
          // 重放未确认队列
          for (const pendingTx of pendingQueueRef.current.values()) {
            send(WSAction.APPLY_TX, pendingTx);
          }
        }
      }
    },
    [send, onConflictNotice]
  );

  // 重连触发差异请求
  const triggerSyncOnReconnect = useCallback(() => {
    send(WSAction.SYNC_REQUEST, { docVersion: doc.version });
  }, [send, doc.version]);

  return {
    doc,
    conflictToast,
    updateBlockContent,
    insertBlockAfter,
    deleteBlock,
    handleServerMessage,
    triggerSyncOnReconnect
  };
}
