import { useState, useCallback, useRef, useEffect } from 'react';
import { WSAction, type UserPresence } from '@co-editor/shared';

interface UsePresenceOptions {
  clientId: string;
  send: <T>(action: WSAction, payload: T) => boolean;
}

export function usePresence({ clientId, send }: UsePresenceOptions) {
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdateRef = useRef<Partial<UserPresence> | null>(null);

  // 节流上报光标与焦点块
  const updateLocalPresence = useCallback(
    (data: Partial<Pick<UserPresence, 'activeBlockId' | 'cursorOffset' | 'username'>>) => {
      pendingUpdateRef.current = { ...pendingUpdateRef.current, ...data };

      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(() => {
          if (pendingUpdateRef.current) {
            send(WSAction.PRESENCE_UPDATE, pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
          throttleTimeoutRef.current = null;
        }, 50);
      }
    },
    [send]
  );

  // 设置服务端下发的全量在线列表
  const handlePresenceBroadcast = useCallback((newPresences: UserPresence[]) => {
    setPresences(newPresences);
  }, []);

  // 自身与协作者分离
  const currentUser = presences.find((p) => p.clientId === clientId);
  const otherUsers = presences.filter((p) => p.clientId !== clientId);

  // 获取特定块当前正在编辑的协作者
  const getCollabUsersOnBlock = useCallback(
    (blockId: string): UserPresence[] => {
      return otherUsers.filter((u) => u.activeBlockId === blockId);
    },
    [otherUsers]
  );

  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current);
    };
  }, []);

  return {
    presences,
    currentUser,
    otherUsers,
    updateLocalPresence,
    handlePresenceBroadcast,
    getCollabUsersOnBlock
  };
}
