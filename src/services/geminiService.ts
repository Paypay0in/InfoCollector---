import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export enum Category {
  FOOD = "FOOD",
  LEARNING = "LEARNING",
  OTHER = "OTHER",
}

export interface CollectedItem {
  id: string;
  title: string;
  category: Category;
  subCategory?: string;
  content: string;
  location?: string;
  region?: string;
  subwayStation?: string;
  nearbyCollege?: string;
  link?: string;
  timestamp: number;
}

export const analyzeImage = async (base64Image: string): Promise<Partial<CollectedItem>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1],
            },
          },
          {
            text: `請分析這張截圖，提取其中的關鍵資訊。
如果是餐廳、甜點店、商店或任何實體店面，請分類為 FOOD；如果是學習資料、知識點或教學，請分類為 LEARNING；其他則為 OTHER。

請執行以下任務：
1. **標題提取**：請明確寫出被分享的「店家名稱」與「具體商品/餐點名稱」。禁止使用如「挖寶」、「好物分享」、「必買」等模糊字眼。格式範例：「[店家名] - [商品名]」。
2. **內容摘要**：請提取重點並保持極簡（不超過 3 個短句）。**每一點都必須獨立一行，使用分項符號（如 • 或 -）開頭，並在每點之間插入換行符號 \\n**。
3. **子分類識別**：如果是 FOOD，請識別具體類型（如：購物、日式料理、韓式料理、甜點、咖啡廳、服飾、拉麵等）。
4. 找出該地點所屬的「行政區或地區 (Region/Area)」，例如：信義區、大安區、澀谷、中西區等。
5. 找出該地點最近的「地鐵/捷運站點 (Subway Station)」。
6. 找出該地點附近是否有「大學或學院 (College/University)」，並簡述。
7. 提供 Google Maps 連結。

請以繁體中文回答。`,
          },
        ],
      },
    ],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "明確的標題，格式為：店家名 - 商品名。禁止使用模糊字眼。" },
          category: { type: Type.STRING, enum: ["FOOD", "LEARNING", "OTHER"], description: "分類" },
          subCategory: { type: Type.STRING, description: "具體的子分類，例如：購物、日式料理、韓式料理、甜點、咖啡廳等" },
          content: { type: Type.STRING, description: "內容摘要，必須包含分項符號與強制換行符號 \\n，確保每點獨立一行" },
          location: { type: Type.STRING, description: "地點或店名" },
          region: { type: Type.STRING, description: "行政區或地區名稱" },
          subwayStation: { type: Type.STRING, description: "最近的地鐵/捷運站" },
          nearbyCollege: { type: Type.STRING, description: "附近的學校或學院" },
          link: { type: Type.STRING, description: "Google Maps 或相關連結" },
        },
        required: ["title", "category", "content"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return {};
  }
};
