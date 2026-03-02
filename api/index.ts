import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Supabase Client Initialization
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const app = express();
app.use(express.json({ limit: '50mb' }));

// API endpoint to fetch items
app.get("/api/items", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for mobile automation
app.post("/api/auto-upload", async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64.split(",")[1] || imageBase64,
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
            category: { type: Type.STRING, description: "分類 (FOOD, LEARNING, OTHER)" },
            subCategory: { type: Type.STRING, description: "具體的子分類" },
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

    const result = JSON.parse(response.text || "{}");
    const timestamp = Date.now();

    console.log("AI analysis successful, inserting into Supabase...");

    const { data, error: dbError } = await supabase
      .from('items')
      .insert([
        {
          title: result.title || '未命名資訊',
          category: result.category || 'OTHER',
          subCategory: result.subCategory,
          content: result.content || '',
          location: result.location,
          region: result.region,
          subwayStation: result.subwayStation,
          nearbyCollege: result.nearbyCollege,
          link: result.link,
          timestamp: timestamp
        }
      ])
      .select();

    if (dbError) {
      console.error("Supabase Insert Error:", dbError);
      return res.status(500).json({ error: `Database Error: ${dbError.message}` });
    }
    
    res.json({ success: true, id: data[0].id, data: result });
  } catch (error: any) {
    console.error("Full Process Error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to process image",
      details: error.stack
    });
  }
});

// API endpoint to delete an item
app.delete("/api/items/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .match({ id: req.params.id });
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Development middleware
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  // We use dynamic import to avoid bundling vite in production
  import("vite").then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Development server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
