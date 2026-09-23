import React, { useState } from 'react';
import type { UserPresence } from '@co-editor/shared';
import type { ConnectionStatus } from '../../composables/useWebSocket.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { CapsuleButton } from '../common/CapsuleButton.js';
import { User, Share2, Check, Plus, FileEdit } from 'lucide-react';

interface TopBarProps {
  docId: string;
  status: ConnectionStatus;
  presences: UserPresence[];
  currentUser?: UserPresence;
  onReconnect: () => void;
  onAddBlock: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  docId,
  status,
  presences,
  currentUser,
  onReconnect,
  onAddBlock
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-4 z-50 w-full max-w-4xl mx-auto mb-6 px-4">
      <div className="glass-panel rounded-pill px-5 py-2.5 flex items-center justify-between gap-4 shadow-soft-md border border-[rgba(0,0,0,0.06)]">
        {/* 左侧：文档标识与标题 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#3E6FDC]/10 flex items-center justify-center text-[#3E6FDC]">
            <FileEdit className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#1c1c1e]">协同文档</span>
              <span className="text-xs text-[#8e8e93] font-mono bg-[rgba(120,120,128,0.08)] px-2 py-0.5 rounded-full">
                {docId}
              </span>
            </div>
          </div>
        </div>

        {/* 中间：网络状态徽章 */}
        <div className="hidden sm:flex items-center">
          <StatusBadge status={status} onReconnect={onReconnect} />
        </div>

        {/* 右侧：协作者头像列表与操作 */}
        <div className="flex items-center gap-3">
          {/* 在线协作者头像组 */}
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {presences.slice(0, 5).map((user) => {
              const isSelf = user.clientId === currentUser?.clientId;
              return (
                <div
                  key={user.clientId}
                  className="relative group cursor-pointer"
                  title={`${user.username} ${isSelf ? '(你)' : ''}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: user.color }}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  {/* 在线微光绿点 */}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#34c759] ring-1 ring-white" />
                </div>
              );
            })}
            {presences.length > 5 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 text-[#8e8e93] text-xs font-medium flex items-center justify-center ring-2 ring-white">
                +{presences.length - 5}
              </div>
            )}
          </div>

          <div className="h-4 w-[1px] bg-black/10 hidden sm:block" />

          {/* 新增块按钮 */}
          <CapsuleButton
            variant="secondary"
            onClick={onAddBlock}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="text-xs py-1.5 px-3"
          >
            插入段落
          </CapsuleButton>

          {/* 分享房间按钮 */}
          <CapsuleButton
            variant={copied ? 'primary' : 'secondary'}
            onClick={handleCopyLink}
            icon={copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            className="text-xs py-1.5 px-3"
          >
            {copied ? '已复制' : '分享'}
          </CapsuleButton>
        </div>
      </div>
    </header>
  );
};
