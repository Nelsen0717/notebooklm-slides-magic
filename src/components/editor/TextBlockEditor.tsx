import { useState, useCallback } from 'react'
import { useSlidesStore, type Slide, type TextBlock } from '@/store/slides-store'
import { cn, generateId } from '@/lib/utils'
import {
  Type,
  Trash2,
  Plus,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface TextBlockEditorProps {
  slide: Slide
}

export function TextBlockEditor({ slide }: TextBlockEditorProps) {
  const { updateTextBlock, addTextBlock, deleteTextBlock } = useSlidesStore()
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)

  const handleTextChange = useCallback((blockId: string, text: string) => {
    updateTextBlock(slide.id, blockId, { text })
  }, [slide.id, updateTextBlock])

  const handleStyleChange = useCallback((
    blockId: string,
    styleKey: keyof TextBlock['style'],
    value: string | number | boolean
  ) => {
    const block = slide.textBlocks.find((b) => b.id === blockId)
    if (!block) return

    updateTextBlock(slide.id, blockId, {
      style: { ...block.style, [styleKey]: value },
    })
  }, [slide.id, slide.textBlocks, updateTextBlock])

  const handleAddBlock = useCallback(() => {
    const newBlock: TextBlock = {
      id: generateId(),
      text: '新文字區塊',
      box: { x: 10, y: 10, width: 30, height: 10 },
      style: {
        fontSize: 24,
        color: '#FFFFFF',
        bold: false,
        align: 'left',
      },
    }
    addTextBlock(slide.id, newBlock)
  }, [slide.id, addTextBlock])

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (confirm('確定要刪除此文字區塊嗎？')) {
      deleteTextBlock(slide.id, blockId)
    }
  }, [slide.id, deleteTextBlock])

  const toggleExpand = useCallback((blockId: string) => {
    setExpandedBlockId((prev) => (prev === blockId ? null : blockId))
  }, [])

  if (slide.status !== 'completed') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Type className="w-12 h-12 text-surface-300 mb-3" />
        <p className="text-dark-50 font-medium">
          處理完成後會顯示文字區塊
        </p>
        <p className="text-sm text-dark-50/70 mt-1">
          AI 會自動辨識簡報中的文字內容和位置
        </p>
      </div>
    )
  }

  if (slide.textBlocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Type className="w-12 h-12 text-surface-300 mb-3" />
        <p className="text-dark-50 font-medium">
          未偵測到文字區塊
        </p>
        <button
          onClick={handleAddBlock}
          className="mt-4 btn-secondary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          手動新增
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
      {slide.textBlocks.map((block, index) => {
        const isExpanded = expandedBlockId === block.id

        return (
          <div
            key={block.id}
            className="border border-surface-200 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div
              onClick={() => toggleExpand(block.id)}
              className="flex items-center justify-between px-4 py-3 bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-dark-50 bg-surface-200 px-2 py-0.5 rounded">
                  #{index + 1}
                </span>
                <span className="text-sm font-medium text-dark truncate max-w-[200px]">
                  {block.text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteBlock(block.id)
                  }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-dark-50" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-dark-50" />
                )}
              </div>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                {/* Text Input */}
                <div>
                  <label className="text-xs font-semibold text-dark-50 uppercase mb-2 block">
                    文字內容
                  </label>
                  <textarea
                    value={block.text}
                    onChange={(e) => handleTextChange(block.id, e.target.value)}
                    rows={3}
                    className="input resize-none"
                  />
                </div>

                {/* Style Controls */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Font Size */}
                  <div>
                    <label className="text-xs font-semibold text-dark-50 uppercase mb-2 block">
                      字型大小
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={8}
                        max={200}
                        value={block.style.fontSize}
                        onChange={(e) =>
                          handleStyleChange(block.id, 'fontSize', Number(e.target.value))
                        }
                        className="input w-20 text-center"
                      />
                      <span className="text-sm text-dark-50">px</span>
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="text-xs font-semibold text-dark-50 uppercase mb-2 block">
                      顏色
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={block.style.color}
                        onChange={(e) =>
                          handleStyleChange(block.id, 'color', e.target.value)
                        }
                        className="w-10 h-10 rounded-lg cursor-pointer border border-surface-300"
                      />
                      <input
                        type="text"
                        value={block.style.color}
                        onChange={(e) =>
                          handleStyleChange(block.id, 'color', e.target.value)
                        }
                        className="input flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Bold & Alignment */}
                <div className="flex items-center gap-4">
                  {/* Bold */}
                  <button
                    onClick={() =>
                      handleStyleChange(block.id, 'bold', !block.style.bold)
                    }
                    className={cn(
                      'p-2 rounded-lg transition-all',
                      block.style.bold
                        ? 'bg-primary text-white'
                        : 'bg-surface-100 text-dark-50 hover:bg-surface-200'
                    )}
                  >
                    <Bold className="w-5 h-5" />
                  </button>

                  {/* Alignment */}
                  <div className="flex items-center bg-surface-100 p-1 rounded-lg">
                    {[
                      { value: 'left', icon: AlignLeft },
                      { value: 'center', icon: AlignCenter },
                      { value: 'right', icon: AlignRight },
                    ].map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() =>
                          handleStyleChange(block.id, 'align', value)
                        }
                        className={cn(
                          'p-2 rounded-lg transition-all',
                          block.style.align === value
                            ? 'bg-white text-primary shadow-soft'
                            : 'text-dark-50 hover:text-dark'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position Info */}
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-xs text-dark-50">
                    位置: X {block.box.x.toFixed(1)}% Y {block.box.y.toFixed(1)}%
                    | 寬度 {block.box.width.toFixed(1)}% 高度 {block.box.height.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add Button */}
      <button
        onClick={handleAddBlock}
        className="w-full py-3 border-2 border-dashed border-surface-300 rounded-xl text-dark-50 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        新增文字區塊
      </button>
    </div>
  )
}
