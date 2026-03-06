import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Supabase Client Initialization
let supabaseClient: any = null;
const getSupabase = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl) {
      throw new Error("環境變數遺失：請在 Vercel 設定 SUPABASE_URL");
    }
    if (!supabaseKey) {
      throw new Error("環境變數遺失：請在 Vercel 設定 SUPABASE_ANON_KEY");
    }
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
};

let aiClient: any = null;
const getAI = () => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("環境變數遺失：請在 Vercel 設定 GEMINI_API_KEY");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

const app = express();
app.use(express.json({ limit: '50mb' }));

// Health check
app.get("/api/health", (req, res) => {
  const envKeys = Object.keys(process.env);
  res.json({ 
    status: "ok", 
    availableKeys: envKeys.filter(key => 
      key.includes("SUPABASE") || key.includes("GEMINI") || key.includes("API")
    ),
    envStatus: {
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
    }
  });
});

// API endpoint to fetch items
app.get("/api/items", async (req, res) => {
  try {
    const supabase = getSupabase();
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
    const ai = getAI();
    const supabase = getSupabase();
    
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
              text: `請分析這張截圖，提取關鍵資訊。
如果包含多個獨立項目（如：三部影集、兩家餐廳），請分別提取。

分類：
1. **FOOD** (探店)：餐廳、咖啡廳。需識別子分類（如：日式、甜點）。
2. **LEARNING** (學習)：教學、筆記。
3. **SHOPPING** (購物)：商店、商品。
4. **OTHER** (其他)：影集、電影、書籍、展覽。需識別子分類。

任務：
1. **標題**：格式「[來源] - [名稱]」。
2. **摘要**：極簡 3 句內，直接換行分隔。
3. **地點資訊**：如果是實體店，識別地區 (Region) 與 Google Maps 搜尋關鍵字。
4. **影集/書籍**：識別串流平台或作者。

請以繁體中文回答。`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              subCategory: { type: Type.STRING },
              content: { type: Type.STRING },
              region: { type: Type.STRING },
              link: { type: Type.STRING, description: "相關搜尋連結或 Maps 連結" },
            },
            required: ["title", "category", "content"],
          },
        },
      },
    });

    const results = JSON.parse(response.text || "[]");
    const timestamp = Date.now();

    if (!Array.isArray(results)) {
      throw new Error("AI returned invalid format (expected array)");
    }

    console.log(`AI analysis successful, found ${results.length} items. Inserting into Supabase...`);

    const itemsToInsert = results.map(result => ({
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
    }));

    const { data, error: dbError } = await supabase
      .from('items')
      .insert(itemsToInsert)
      .select();

    if (dbError) {
      console.error("Supabase Insert Error:", dbError);
      return res.status(500).json({ 
        error: `資料庫寫入失敗：${dbError.message}`,
        details: dbError
      });
    }
    
    res.json({ success: true, count: data.length, items: data });
  } catch (error: any) {
    console.error("Full Process Error:", error);
    res.status(500).json({ 
      error: `AI 分析失敗或超時：${error.message}`,
      details: error.stack
    });
  }
});

// API endpoint to update item category/subcategory
app.patch("/api/items/:id/category", async (req, res) => {
  const { category, subCategory } = req.body;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('items')
      .update({ category, subCategory })
      .match({ id: req.params.id })
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to update completion status
app.patch("/api/items/:id/complete", async (req, res) => {
  const { isCompleted, completionNote, completionDate, rating } = req.body;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('items')
      .update({ isCompleted, completionNote, completionDate, rating })
      .match({ id: req.params.id })
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete an item
app.delete("/api/items/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
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
