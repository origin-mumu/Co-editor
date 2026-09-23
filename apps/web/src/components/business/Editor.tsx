import React from 'react';
import type { Block, UserPresence } from '@co-editor/shared';
import { BlockItem } from './BlockItem.js';
import { AlertCircle } from 'lucide-react';

interface EditorProps {
  blocks: Block[];
  conflictToast: string | null;
  getCollabUsersOnBlock: (blockId: string) => UserPresence[];
  onUpdateBlock: (blockId: string, content: string) => void;
  onInsertAfter: (prevBlockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onFocusBlock: (blockId: string, offset: number) => void;
  onBlurBlock: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  blocks,
  conflictToast,
  getCollabUsersOnBlock,
  onUpdateBlock,
  onInsertAfter,
  onDeleteBlock,
  onFocusBlock,
  onBlurBlock
}) => {
  return (
    <main className="w-full max-w-4xl mx-auto px-4 pb-16">
      {/* 冲突提示气泡 */}
      {conflictToast && (
        <div className="mb-4 p-3 rounded-pill bg-[#ff9500]/10 border border-[#ff9500]/20 text-[#b26800] text-sm flex items-center gap-2 animate-fadeIn shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#ff9500]" />
          <span>{conflictToast}</span>
        </div>
      )}

      {/* Bento 主卡片 (纯白不透底，四周预留安全间距防阴影裁切) */}
      <div className="bento-card bg-white rounded-card p-8 sm:p-12 min-h-[600px] shadow-soft-lg border border-[rgba(0,0,0,0.06)]">
        {/* 文档头部大标题 */}
        <div className="mb-8 pb-4 border-b border-gray-100">
          <h1 className="text-3xl font-bold tracking-tight text-[#1c1c1e]">
            实时协同工作台
          </h1>
          <p className="text-sm text-[#8e8e93] mt-1.5">
            基于原生 DOM 渲染与 Block 架构，支持多浏览器毫秒级双向同步、CAS 乐观并发控制与断网自愈。
          </p>
        </div>

        {/* 块级列表渲染 */}
        <div className="space-y-1">
          {blocks.map((block) => (
            <BlockItem
              key={block.id}
              block={block}
              collaborators={getCollabUsersOnBlock(block.id)}
              onChange={(content) => onUpdateBlock(block.id, content)}
              onEnter={() => onInsertAfter(block.id)}
              onBackspace={() => onDeleteBlock(block.id)}
              onFocus={(offset) => onFocusBlock(block.id, offset)}
              onBlur={onBlurBlock}
            />
          ))}

          {blocks.length === 0 && (
            <div className="text-center py-16 text-[#8e8e93] text-sm">
              文档为空，正在同步或点击上方“插入段落”开始输入...
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
