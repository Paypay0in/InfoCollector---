import express from "express";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
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

// API endpoint to save items processed by AI on the frontend
app.post("/api/save-items", async (req, res) => {
  const { results } = req.body;
  
  if (!Array.isArray(results)) {
    return res.status(400).json({ error: "Results must be an array" });
  }

  try {
    const supabase = getSupabase();
    const timestamp = Date.now();
    
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
      return res.status(500).json({ error: dbError.message });
    }
    
    res.json({ success: true, count: data.length, items: data });
  } catch (error: any) {
    console.error("Save Items Error:", error);
    res.status(500).json({ error: error.message });
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
