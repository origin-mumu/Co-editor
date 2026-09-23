import { useEffect, useRef, useState, useCallback } from 'react';
import { WSAction, type WSEnvelope } from '@co-editor/shared';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'SYNCING';

interface UseWebSocketOptions {
  url: string;
  docId: string;
  clientId: string;
  username: string;
  onMessage: (envelope: WSEnvelope) => void;
  onReconnected?: () => void;
}

export function useWebSocket({
  url,
  docId,
  clientId,
  username,
  onMessage,
  onReconnected
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUnmountedRef = useRef(false);

  // 发送消息辅助函数
  const send = useCallback(<T,>(action: WSAction, payload: T): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const envelope: WSEnvelope<T> = {
        action,
        docId,
        clientId,
        timestamp: Date.now(),
        payload
      };
      wsRef.current.send(JSON.stringify(envelope));
      return true;
    }
    return false;
  }, [docId, clientId]);

  // 建立连接
  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      setStatus(prev => (prev === 'DISCONNECTED' ? 'RECONNECTING' : prev));
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return ws.close();
        console.log('[WS:OPEN] Connected to %s', url);
        setStatus('CONNECTED');
        const wasReconnecting = reconnectAttemptRef.current > 0;
        reconnectAttemptRef.current = 0;

        // 发送 JOIN_ROOM
        send(WSAction.JOIN_ROOM, { username });

        // 启动客户端心跳 Ping
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          send(WSAction.PING, {});
        }, 15000);

        if (wasReconnecting && onReconnected) {
          onReconnected();
        }
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const envelope = JSON.parse(event.data);
          onMessage(envelope);
        } catch (err) {
          console.error('[WS:PARSE_ERR]', err);
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        console.warn('[WS:CLOSE] Connection lost, scheduling reconnect...');
        setStatus('DISCONNECTED');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // 指数退避自动重连
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000);
        reconnectAttemptRef.current += 1;
        setStatus('RECONNECTING');

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('[WS:ERROR]', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WS:CONN_FAIL]', err);
    }
  }, [url, username, send, onMessage, onReconnected]);

  // 手动重连
  const reconnectNow = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectAttemptRef.current = 0;
    if (wsRef.current) wsRef.current.close();
    connect();
  }, [connect]);

  // 生命周期管理
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    status,
    setStatus,
    send,
    reconnectNow
  };
}
