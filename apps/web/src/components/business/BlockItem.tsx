import React, { useRef, useEffect, useState } from 'react';
import type { Block, UserPresence } from '@co-editor/shared';
import { User, GripVertical } from 'lucide-react';

interface BlockItemProps {
  block: Block;
  collaborators: UserPresence[];
  onChange: (content: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  onFocus: (offset: number) => void;
  onBlur: () => void;
  autoFocus?: boolean;
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  collaborators,
  onChange,
  onEnter,
  onBackspace,
  onFocus,
  onBlur,
  autoFocus = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  // 动态自动撑高 Textarea 高度
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [block.content]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing) return;

    // 回车新增块
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
      return;
    }

    // 退格在开头删除/合并块
    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      onBackspace();
      return;
    }
  };

  const primaryCollab = collaborators[0];

  return (
    <div
      className={`group relative flex items-start gap-2 px-3 py-1.5 rounded-lg transition-all ${
        primaryCollab
          ? 'ring-2 ring-offset-2 ring-opacity-70 bg-white shadow-sm'
          : 'hover:bg-[rgba(120,120,128,0.04)]'
      }`}
      style={primaryCollab ? { borderColor: primaryCollab.color, boxShadow: `0 0 0 2px ${primaryCollab.color}33` } : undefined}
    >
      {/* 协作者正在编辑的悬浮指示标 */}
      {primaryCollab && (
        <div
          className="absolute -top-3 left-4 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white shadow-sm font-medium animate-fadeIn select-none"
          style={{ backgroundColor: primaryCollab.color }}
        >
          <User className="w-2.5 h-2.5" />
          <span>{primaryCollab.username} 正在编辑</span>
        </div>
      )}

      {/* 左侧微弱拖拽手柄/占位符 */}
      <div className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity pt-1 text-[#8e8e93] cursor-grab">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* 核心 DOM 输入区 */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={block.content}
        placeholder="输入内容，按回车新建段落..."
        onChange={(e) => {
          onChange(e.target.value);
          adjustHeight();
        }}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          onChange(e.currentTarget.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={(e) => onFocus(e.target.selectionStart)}
        onBlur={onBlur}
        onClick={(e) => onFocus(e.currentTarget.selectionStart)}
        onKeyUp={(e) => onFocus(e.currentTarget.selectionStart)}
        className="w-full resize-none overflow-hidden bg-transparent border-none text-[#1c1c1e] text-base leading-relaxed focus:outline-none placeholder:text-[#c7c7cc]"
      />
    </div>
  );
};
