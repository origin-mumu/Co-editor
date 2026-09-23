import React from 'react';
import type { ConnectionStatus } from '../../composables/useWebSocket.js';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
  status: ConnectionStatus;
  onReconnect?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onReconnect }) => {
  const configs = {
    CONNECTED: {
      text: '实时协同中',
      icon: <Wifi className="w-3.5 h-3.5 text-[#34c759]" />,
      dotClass: 'bg-[#34c759]',
      containerClass: 'bg-[rgba(52,199,89,0.12)] text-[#248a3d] border-[rgba(52,199,89,0.2)]'
    },
    RECONNECTING: {
      text: '正在重新连接...',
      icon: <RefreshCw className="w-3.5 h-3.5 text-[#ff9500] animate-spin" />,
      dotClass: 'bg-[#ff9500] animate-ping',
      containerClass: 'bg-[rgba(255,149,0,0.12)] text-[#b26800] border-[rgba(255,149,0,0.2)]'
    },
    DISCONNECTED: {
      text: '网络已断开 (离线保存)',
      icon: <WifiOff className="w-3.5 h-3.5 text-[#ff3b30]" />,
      dotClass: 'bg-[#ff3b30]',
      containerClass: 'bg-[rgba(255,59,48,0.12)] text-[#d7261d] border-[rgba(255,59,48,0.2)]'
    },
    SYNCING: {
      text: '正在对齐版本...',
      icon: <RefreshCw className="w-3.5 h-3.5 text-[#3E6FDC] animate-spin" />,
      dotClass: 'bg-[#3E6FDC]',
      containerClass: 'bg-[rgba(62,111,220,0.1)] text-[#3E6FDC] border-[rgba(62,111,220,0.2)]'
    }
  };

  const current = configs[status];

  return (
    <div
      onClick={status !== 'CONNECTED' ? onReconnect : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
        current.containerClass
      } ${status !== 'CONNECTED' ? 'cursor-pointer hover:opacity-80' : ''}`}
      title={status !== 'CONNECTED' ? '点击立即尝试重连' : '网络正常'}
    >
      <span className="relative flex h-2 w-2">
        <span className={`rounded-full h-2 w-2 ${current.dotClass}`} />
      </span>
      {current.icon}
      <span>{current.text}</span>
    </div>
  );
};
