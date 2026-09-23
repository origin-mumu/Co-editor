import React, { useState, useMemo, useCallback, useRef } from 'react';
import { WSAction, type WSEnvelope } from '@co-editor/shared';
import { useWebSocket } from './composables/useWebSocket.js';
import { usePresence } from './composables/usePresence.js';
import { useEditorSync } from './composables/useEditorSync.js';
import { TopBar } from './components/business/TopBar.js';
import { Editor } from './components/business/Editor.js';
import { nanoid } from 'nanoid';

// 从 URL 获取 room，否则默认 doc-default
function getInitialDocId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') || 'doc-default';
}

// 每个浏览器标签页持久化一个独立的 clientId
function getOrCreateClientId(): string {
  let id = sessionStorage.getItem('co_editor_client_id');
  if (!id) {
    id = `user-${nanoid(6)}`;
    sessionStorage.setItem('co_editor_client_id', id);
  }
  return id;
}

export const App: React.FC = () => {
  const docId = useMemo(() => getInitialDocId(), []);
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const username = useMemo(() => `用户 ${clientId.slice(-4)}`, [clientId]);

  // 后端 WebSocket 地址
  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:8080`;
  }, []);

  const presenceRef = useRef<ReturnType<typeof usePresence> | null>(null);
  const syncRef = useRef<ReturnType<typeof useEditorSync> | null>(null);

  // 1. 底层消息分发中继 (引用稳定化)
  const handleServerMessage = useCallback((envelope: WSEnvelope) => {
    if (envelope.action === WSAction.PRESENCE_BROADCAST) {
      presenceRef.current?.handlePresenceBroadcast(envelope.payload as any);
      return;
    }
    syncRef.current?.handleServerMessage(envelope);
  }, []);

  const handleReconnected = useCallback(() => {
    syncRef.current?.triggerSyncOnReconnect();
  }, []);

  // 2. 初始化网络 Hook
  const { status, send, reconnectNow } = useWebSocket({
    url: wsUrl,
    docId,
    clientId,
    username,
    onMessage: handleServerMessage,
    onReconnected: handleReconnected
  });

  // 3. 初始化协同感知 Hook
  const presence = usePresence({
    clientId,
    send
  });
  presenceRef.current = presence;

  // 4. 初始化状态同步 Hook
  const sync = useEditorSync({
    clientId,
    docId,
    send
  });
  syncRef.current = sync;

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col pt-4">
      {/* 悬浮胶囊导航栏 */}
      <TopBar
        docId={docId}
        status={status}
        presences={presence.presences}
        currentUser={presence.currentUser}
        onReconnect={reconnectNow}
        onAddBlock={() => {
          const lastBlock = sync.doc.blocks[sync.doc.blocks.length - 1];
          if (lastBlock) {
            sync.insertBlockAfter(lastBlock.id);
          }
        }}
      />

      {/* 主舞台编辑器 */}
      <Editor
        blocks={sync.doc.blocks}
        conflictToast={sync.conflictToast}
        getCollabUsersOnBlock={presence.getCollabUsersOnBlock}
        onUpdateBlock={sync.updateBlockContent}
        onInsertAfter={sync.insertBlockAfter}
        onDeleteBlock={sync.deleteBlock}
        onFocusBlock={(blockId, offset) => {
          presence.updateLocalPresence({ activeBlockId: blockId, cursorOffset: offset });
        }}
        onBlurBlock={() => {
          presence.updateLocalPresence({ activeBlockId: null });
        }}
      />
    </div>
  );
};

export default App;
