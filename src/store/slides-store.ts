import { create } from 'zustand'

export interface TextBlock {
  id: string
  text: string
  box: {
    x: number  // percentage 0-100
    y: number
    width: number
    height: number
  }
  style: {
    fontSize: number
    color: string
    bold: boolean
    align: 'left' | 'center' | 'right'
  }
}

export interface Slide {
  id: string
  pageNumber: number
  originalImage: string  // base64 data URL
  cleanImage?: string    // watermark removed
  textBlocks: TextBlock[]
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
}

export type ExportMode = 'images' | 'text' | 'combined'

interface SlidesStore {
  // State
  step: 1 | 2 | 3
  slides: Slide[]
  selectedSlideIds: Set<string>
  currentSlideIndex: number
  isProcessing: boolean
  processingProgress: number
  exportMode: ExportMode
  exportFilename: string

  // Actions
  setStep: (step: 1 | 2 | 3) => void
  setSlides: (slides: Slide[]) => void
  addSlide: (slide: Slide) => void
  updateSlide: (id: string, updates: Partial<Slide>) => void
  toggleSlideSelection: (id: string) => void
  selectAllSlides: () => void
  deselectAllSlides: () => void
  invertSelection: () => void
  setCurrentSlideIndex: (index: number) => void
  setIsProcessing: (isProcessing: boolean) => void
  setProcessingProgress: (progress: number) => void
  setExportMode: (mode: ExportMode) => void
  setExportFilename: (filename: string) => void
  updateTextBlock: (slideId: string, blockId: string, updates: Partial<TextBlock>) => void
  addTextBlock: (slideId: string, block: TextBlock) => void
  deleteTextBlock: (slideId: string, blockId: string) => void
  reset: () => void
}

const initialState = {
  step: 1 as const,
  slides: [] as Slide[],
  selectedSlideIds: new Set<string>(),
  currentSlideIndex: 0,
  isProcessing: false,
  processingProgress: 0,
  exportMode: 'combined' as ExportMode,
  exportFilename: `NotebookLM_Export_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
}

export const useSlidesStore = create<SlidesStore>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setSlides: (slides) => set({ slides }),

  addSlide: (slide) => set((state) => ({
    slides: [...state.slides, slide],
  })),

  updateSlide: (id, updates) => set((state) => ({
    slides: state.slides.map((slide) =>
      slide.id === id ? { ...slide, ...updates } : slide
    ),
  })),

  toggleSlideSelection: (id) => set((state) => {
    const newSelected = new Set(state.selectedSlideIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    return { selectedSlideIds: newSelected }
  }),

  selectAllSlides: () => set((state) => ({
    selectedSlideIds: new Set(state.slides.map((s) => s.id)),
  })),

  deselectAllSlides: () => set({ selectedSlideIds: new Set() }),

  invertSelection: () => set((state) => {
    const newSelected = new Set<string>()
    state.slides.forEach((slide) => {
      if (!state.selectedSlideIds.has(slide.id)) {
        newSelected.add(slide.id)
      }
    })
    return { selectedSlideIds: newSelected }
  }),

  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),

  setIsProcessing: (isProcessing) => set({ isProcessing }),

  setProcessingProgress: (progress) => set({ processingProgress: progress }),

  setExportMode: (mode) => set({ exportMode: mode }),

  setExportFilename: (filename) => set({ exportFilename: filename }),

  updateTextBlock: (slideId, blockId, updates) => set((state) => ({
    slides: state.slides.map((slide) =>
      slide.id === slideId
        ? {
            ...slide,
            textBlocks: slide.textBlocks.map((block) =>
              block.id === blockId ? { ...block, ...updates } : block
            ),
          }
        : slide
    ),
  })),

  addTextBlock: (slideId, block) => set((state) => ({
    slides: state.slides.map((slide) =>
      slide.id === slideId
        ? { ...slide, textBlocks: [...slide.textBlocks, block] }
        : slide
    ),
  })),

  deleteTextBlock: (slideId, blockId) => set((state) => ({
    slides: state.slides.map((slide) =>
      slide.id === slideId
        ? {
            ...slide,
            textBlocks: slide.textBlocks.filter((block) => block.id !== blockId),
          }
        : slide
    ),
  })),

  reset: () => set(initialState),
}))
