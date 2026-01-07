# 方睿簡報魔法師 | FUNRAISE Slides Magic

將 NotebookLM 生成的 PDF 簡報轉換為可編輯的 PowerPoint 檔案。

## 功能特點

### Step 1: 上傳 & 選擇
- 拖放或點擊上傳 NotebookLM PDF
- 高解析度頁面預覽 (scale 2.5+)
- 靈活的多選模式 (點擊、Shift+範圍選取、全選)
- 可調整縮圖大小

### Step 2: AI 處理 & 編輯
- **浮水印移除**: 使用 Gemini AI 智慧填補移除 "NotebookLM" 浮水印
- **文字提取**: OCR 辨識文字內容、位置、字型大小、顏色
- **文字編輯**: 編輯內容、調整樣式、新增/刪除區塊
- **批次處理**: 佇列系統支援暫停/繼續，自動處理頻率限制

### Step 3: 匯出
三種匯出模式:
1. **純圖片**: 只匯出移除浮水印後的圖片
2. **純文字**: 只匯出文字區塊，保留位置與樣式
3. **圖片 + 文字**: 圖片為背景，文字疊加在上方

## 技術架構

- **前端**: React 18 + Vite + TypeScript
- **樣式**: Tailwind CSS + FUNRAISE 品牌色彩
- **PDF 處理**: PDF.js
- **PPT 生成**: PptxGenJS
- **狀態管理**: Zustand
- **AI API**: Gemini 2.0 Flash (OCR + Image Inpainting)
- **部署**: Vercel

## 快速開始

### 本地開發

```bash
# 安裝依賴
npm install

# 建立環境變數
cp .env.example .env.local
# 編輯 .env.local 填入你的 GEMINI_API_KEY

# 啟動開發伺服器
npm run dev
```

### 環境變數

在 `.env.local` 中設定:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

取得 API Key: https://aistudio.google.com/app/apikey

### 建置

```bash
npm run build
npm run preview
```

## 部署到 Vercel

1. Fork 或 clone 此專案
2. 在 Vercel 建立新專案並連結 GitHub
3. 設定環境變數: `GEMINI_API_KEY`
4. 部署

## 專案結構

```
src/
├── components/
│   ├── upload/          # PDF 上傳元件
│   ├── editor/          # 編輯器元件
│   └── export/          # 匯出元件
├── lib/
│   ├── pdf-parser.ts    # PDF 解析
│   ├── gemini-client.ts # Gemini API 客戶端
│   ├── pptx-generator.ts# PPT 生成
│   └── utils.ts         # 工具函式
├── store/
│   └── slides-store.ts  # Zustand 狀態管理
└── App.tsx              # 主應用程式

api/
└── process-slide.ts     # Vercel Serverless API
```

## API 限制

Gemini 免費方案限制:
- 每分鐘 15 次請求
- 每日 1500 次請求

系統已內建:
- 請求佇列與 4 秒間隔
- 指數退避重試機制
- 進度顯示與預估時間

## 授權

MIT License

---

Built with love by FUNRAISE 方睿科技
