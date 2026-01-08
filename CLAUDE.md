# CLAUDE.md - NotebookLM Slides Magic

**Project**: NotebookLM 簡報魔法師 (NotebookLM Slides Magic)
**Created**: 2026-01-07
**Version**: 1.1
**Last Update**: 2026-01-07

---

## 溝通規則 (Communication Rules)

**重要**：與用戶的所有溝通都必須使用**繁體中文**！

- 回覆、思考過程、中間討論都以繁體中文為主
- 程式碼註解可以使用英文
- API 文檔引用可以保留原文

---

## 專案狀態 (Current Status)

### ✅ 已解決
- 浮水印移除（黑色遮罩 + AI 移除策略成功）
- 文字清除（圖片處理模塊運作正常）

### ⏳ 待修復
- 文字位置對齊
- 文字大小縮放
- 文字顏色辨識（金色常被誤判為白色）

### 🚫 不要動
- 圖片處理模塊（`performInpainting`）- 已經運作正常！

---

## Project Overview

A web tool to convert NotebookLM PDF slides into editable PowerPoint files.

**Workflow**:
1. Upload PDF → Parse with PDF.js (scale 2.5)
2. AI removes text from images (Gemini Image Generation)
3. OCR extracts text with coordinates (Gemini Flash)
4. Export as PPT with editable text layers (PptxGenJS)

---

## CRITICAL: Gemini API Configuration

### Correct Model Names (Verified Working)

| Purpose | Model Name | Notes |
|---------|------------|-------|
| **OCR (Text Extraction)** | `gemini-2.5-flash-preview-09-2025` | Structured output with JSON schema |
| **Image Cleanup** | `gemini-2.5-flash-image` | "Nano Banana" - for inpainting |

### API Endpoint Format

```
https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={API_KEY}
```

### WRONG Model Names (DO NOT USE)

These model names are **INCORRECT** and will cause failures:

- ❌ `gemini-2.0-flash-exp-image-generation` - Does not exist
- ❌ `gemini-2.5-flash-image-generation` - Wrong format
- ❌ `gemini-2.0-flash-exp` - Wrong model for image generation

### Required Parameters for Image Generation

```json
{
  "contents": [{
    "parts": [
      { "text": "your prompt here" },
      { "inlineData": { "mimeType": "image/png", "data": "base64_string" } }
    ]
  }],
  "generationConfig": {
    "responseModalities": ["IMAGE"]
  }
}
```

### User API Tier

**Current**: Tier 1 API
- Rate limits apply
- Must use models available for Tier 1

---

## Watermark Removal Strategy

### Working Approach: Black Mask + Explicit Removal Prompt

1. **Apply black mask** over watermark area BEFORE sending to AI
2. **Tell the AI explicitly** to remove the black box and inpaint

```javascript
// Watermark location (consistent in NotebookLM)
const maskW = img.width * 0.13;  // 13% width
const maskH = img.height * 0.06; // 6% height
const x = img.width - maskW;     // Bottom right
const y = img.height - maskH;

ctx.fillStyle = "#000000";
ctx.fillRect(x, y, maskW, maskH);
```

### Prompt Templates (Rotate on Retry)

```javascript
const promptVariations = [
  // 1. Most explicit - tell AI about the black box
  `INPAINTING & CLEANUP TASK:
   1. There is a BLACK MASK BOX in the bottom-right corner. It is covering a logo. You MUST remove this black box and reconstruct the background behind it.
   2. Remove ALL other text from the slide.
   3. The final result should contain NO text and NO black box.
   4. Output the clean image only.`,

  // 2. Direct instruction
  `Edit this image. Remove all text. There is a black rectangle in the bottom-right corner blocking a watermark. Remove the black rectangle and fill the gap with the background pattern.`,

  // 3. Simple
  `Remove all text. Remove the black square in the corner. Return clean background.`,
];
```

### Why Simple "Remove Watermark" Fails

- AI models are better at **removing visible objects** than **inpainting masked areas**
- When you tell AI "remove watermark", it may:
  - Fail to detect the exact watermark pixels
  - Only partially remove it
  - Return original image unchanged

- When you **paint a black box** and tell AI to **remove the black box**:
  - AI clearly sees what needs to be removed (the black area)
  - AI understands it must reconstruct the background
  - Much higher success rate

---

## Text Overlay Positioning

### Problem: `object-contain` Creates Letterboxing

When using `object-contain`, the image may not fill the entire container.
Text positions (in percentages) must be calculated relative to the **actual image bounds**, not the container.

### Solution: Calculate Image Bounds

```typescript
const getImageBounds = () => {
  const containerAspect = containerSize.width / containerSize.height;
  const imageAspect = 16 / 9; // NotebookLM slides are always 16:9

  let imgWidth, imgHeight, imgLeft, imgTop;

  if (containerAspect > imageAspect) {
    // Container wider than image - horizontal letterboxing
    imgHeight = containerSize.height;
    imgWidth = imgHeight * imageAspect;
    imgLeft = (containerSize.width - imgWidth) / 2;
    imgTop = 0;
  } else {
    // Container taller than image - vertical letterboxing
    imgWidth = containerSize.width;
    imgHeight = imgWidth / imageAspect;
    imgLeft = 0;
    imgTop = (containerSize.height - imgHeight) / 2;
  }

  return { imgWidth, imgHeight, imgLeft, imgTop };
};

// Position text relative to image bounds
const leftPx = imgLeft + (block.box.x / 100) * imgWidth;
const topPx = imgTop + (block.box.y / 100) * imgHeight;
```

### Font Size Scaling

OCR returns font sizes based on 1920x1080 resolution. Scale based on actual image width:

```typescript
const ORIGINAL_WIDTH = 1920;
const FONT_SIZE_BOOST = 1.15; // OCR tends to underestimate

const scaleFactor = imgWidth / ORIGINAL_WIDTH;
const scaledFontSize = Math.round(block.style.fontSize * scaleFactor * FONT_SIZE_BOOST);
```

---

## OCR Coordinate System

```
box_2d: [ymin, xmin, ymax, xmax]
```

- Scale: 0-1000 (where 1000 = full width/height)
- Origin: Top-left corner (0, 0)
- Convert to percentage: divide by 10

```typescript
const box = {
  x: block.box_2d[1] / 10,      // xmin → left %
  y: block.box_2d[0] / 10,      // ymin → top %
  width: (block.box_2d[3] - block.box_2d[1]) / 10,
  height: (block.box_2d[2] - block.box_2d[0]) / 10,
};
```

---

## Error Handling & Retry Strategy

### Two Types of Retries

1. **Infrastructure Retries** (network/rate-limit)
   - HTTP 429 (rate limit)
   - HTTP 5xx (server errors)
   - Network timeouts
   - Exponential backoff with jitter

2. **Application Retries** (valid response but no image)
   - API returns text instead of image
   - Rotate through different prompts
   - Fixed delay between attempts

```typescript
const MAX_INFRA_RETRIES = 3;
const MAX_APP_RETRIES = 5;

// Infrastructure: exponential backoff
const infraDelay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;

// Application: fixed delay with prompt rotation
const appDelay = 1500 * attempt;
```

---

## File Structure

```
/Users/nelsen/NotebookLM Slides Magic/
├── api/
│   └── process-slide.ts      # Vercel serverless - Gemini API proxy
├── src/
│   ├── components/
│   │   ├── upload/
│   │   │   ├── PdfDropzone.tsx
│   │   │   └── SlideGrid.tsx
│   │   └── editor/
│   │       ├── SlidePreview.tsx  # Text overlay positioning
│   │       ├── SlideEditor.tsx
│   │       └── TextEditor.tsx
│   ├── lib/
│   │   ├── gemini-client.ts   # Client-side API calls
│   │   ├── pdf-parser.ts
│   │   └── utils.ts
│   └── store/
│       └── slides-store.ts    # Zustand state
├── .env.local                 # GEMINI_API_KEY
├── vercel.json
└── CLAUDE.md                  # This file
```

---

## Development Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod
```

---

## Key Learnings & Mistakes to Avoid

### 1. Always Verify API Model Names

Before using any Gemini API model:
1. Check official documentation: https://ai.google.dev/gemini-api/docs
2. Verify model exists for your API tier
3. Test with a simple request before building features

### 2. Image Generation Models Are Specific

Not all Gemini models support image generation. The "flash" models are for text. Use "image" models for inpainting.

### 3. Black Mask Strategy Works Better

For watermark removal:
- DON'T: Ask AI to "find and remove the watermark"
- DO: Paint black box over watermark, ask AI to "remove the black box"

### 4. Always Log API Responses

When debugging:
```typescript
console.log('API Response:', JSON.stringify(data).substring(0, 500));
```

### 5. Test on Different Background Types

- Solid color backgrounds
- Gradient backgrounds
- Image/photo backgrounds

Each may need different handling or prompts.

---

## Reference Implementation

Working version: https://github.com/Nelsen0717/NotebookLM-Slides-Magic-Studio

Key file: `services/geminiService.ts`

---

## Version History

- **v1.0** (2026-01-07): Initial CLAUDE.md
  - Documented correct Gemini API model names
  - Recorded watermark removal strategy
  - Noted text positioning calculations
  - Listed common mistakes to avoid
