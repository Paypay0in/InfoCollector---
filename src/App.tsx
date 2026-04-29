import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  ExternalLink, 
  MapPin, 
  Train, 
  GraduationCap, 
  Utensils, 
  BookOpen, 
  MoreHorizontal,
  ChevronRight,
  Clock,
  LayoutGrid,
  List as ListIcon,
  X,
  Upload,
  Loader2,
  TrainFront,
  School,
  Map,
  Image as ImageIcon,
  Star,
  Route,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum Category {
  FOOD = 'FOOD',
  LEARNING = 'LEARNING',
  SHOPPING = 'SHOPPING',
  OTHER = 'OTHER',
  ALL = 'ALL'
}

interface CollectedItem {
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
  isCompleted?: boolean;
  completionNote?: string;
  completionDate?: string;
  rating?: number;
}

const App: React.FC = () => {
  const [items, setItems] = useState<CollectedItem[]>([]);
  const [filter, setFilter] = useState<Category>(Category.ALL);
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CollectedItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [startLocation, setStartLocation] = useState('');
  const [freeTime, setFreeTime] = useState('4');
  const [plannerType, setPlannerType] = useState<'SHOPPING' | 'DINING' | 'BOTH' | 'ATTRACTIONS'>('BOTH');
  const [itinerary, setItinerary] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  
  // Completion form state
  const [isCompleting, setIsCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rating, setRating] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedItem) {
      setNote(selectedItem.completionNote || '');
      setDate(selectedItem.completionDate || new Date().toISOString().split('T')[0]);
      setRating(selectedItem.rating || 0);
      setIsCompleting(false);
    }
  }, [selectedItem]);

  const toggleComplete = async (id: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/items/${id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isCompleted, 
          completionNote: isCompleted ? note : null, 
          completionDate: isCompleted ? date : null,
          rating: isCompleted ? rating : 0
        }),
      });
      if (response.ok) {
        const updatedItem = await response.json();
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
        setSelectedItem(prev => prev?.id === id ? { ...prev, ...updatedItem } : prev);
        setIsCompleting(false);
      }
    } catch (e) {
      console.error('Failed to update completion status', e);
    }
  };

  const updateCategory = async (id: string, newCategory: Category) => {
    try {
      const response = await fetch(`/api/items/${id}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      if (response.ok) {
        const updatedItem = await response.json();
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
        setSelectedItem(prev => prev?.id === id ? { ...prev, ...updatedItem } : prev);
      }
    } catch (e) {
      console.error('Failed to update category', e);
    }
  };

  const getCompleteLabel = (item: CollectedItem) => {
    if (item.category === Category.FOOD) return '已訪';
    if (item.category === Category.LEARNING) return '已閱讀';
    if (item.category === Category.SHOPPING) return '已購買';
    if (item.category === Category.OTHER) {
      if (item.subCategory?.includes('影集') || item.subCategory?.includes('電影')) return '已觀看';
      if (item.subCategory?.includes('書籍')) return '已閱讀';
      return '已完成';
    }
    return '已完成';
  };

  const formatContent = (content: string) => {
    if (!content) return '';
    // Replace literal \n or /n with actual newlines
    return content.replace(/\\n/g, '\n').replace(/\/n/g, '\n');
  };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items');
        if (response.ok) {
          const data = await response.json();
          setItems(data);
        }
      } catch (e) {
        console.error('Failed to load items', e);
      }
    };
    fetchItems();
  }, []);

  const processFile = async (file: File) => {
    setIsUploading(true);
    try {
      console.log('Starting image processing...');
      const compressedBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 800; // 再次縮小尺寸以極速傳輸
            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.5)); // 質量降至 0.5
          };
        };
      });

      console.log('Image compressed, calling Gemini...');
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key 尚未設定，請檢查環境變數");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: compressedBase64.split(",")[1] || compressedBase64,
                },
              },
              {
                text: `分析截圖提取資訊。多項目請分開。
分類：FOOD, LEARNING, SHOPPING, OTHER。
任務：
1. 標題：僅名稱。
2. 摘要：分點(•)換行，極簡。
3. 連結：FOOD/SHOPPING必填Google Maps搜尋連結(query=名稱+地區)。
4. 地點：提取地區與捷運站。
繁體中文JSON回答。`,
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
                subwayStation: { type: Type.STRING },
                link: { type: Type.STRING },
              },
              required: ["title", "category", "content"],
            },
          },
        },
      });

      console.log('Gemini responded, parsing results...');
      const results = JSON.parse(response.text || "[]");
      
      if (!Array.isArray(results) || results.length === 0) {
        throw new Error("AI 未能識別出有效資訊");
      }

      // Save results to database via backend
      const saveResponse = await fetch('/api/save-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(`資料庫儲存失敗：${errorData.error || saveResponse.statusText}`);
      }
      
      const responseData = await saveResponse.json();
      const { items: newItemsFromApi } = responseData;
      
      if (Array.isArray(newItemsFromApi)) {
        setItems(prev => [...newItemsFromApi, ...prev]);
      }
    } catch (error: any) {
      console.error('Error processing image:', error);
      alert(`處理失敗：${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這筆資訊嗎？')) {
      try {
        const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
        if (response.ok) {
          setItems(prev => prev.filter(item => item.id !== id));
          if (selectedItem?.id === id) setSelectedItem(null);
        }
      } catch (e) {
        console.error('Failed to delete item', e);
      }
    }
  };

  const handlePlanItinerary = async () => {
    if (!startLocation) {
      alert('請輸入出發地點');
      return;
    }
    setIsPlanning(true);
    setItinerary('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const relevantItems = items.filter(item => !item.isCompleted); // Only plan with unvisited items
      
      if (relevantItems.length === 0) {
        setItinerary('您的收藏清單中目前沒有未完成的項目，請先新增一些資訊後再進行規劃。');
        setIsPlanning(false);
        return;
      }

      const prompt = `
        你是一個專業的行程規劃師。用戶想要規劃一個行程。
        
        出發地點：${startLocation}
        空閒時間：${freeTime} 小時
        行程偏好：${
          plannerType === 'SHOPPING' ? '純逛街（優先挑選購物類店鋪）' : 
          plannerType === 'DINING' ? '吃飯（優先挑選餐廳/咖啡廳）' : 
          plannerType === 'BOTH' ? '逛街加吃飯（平衡購物與餐飲）' : '景點（優先挑選景點或文化場所）'
        }
        
        以下是用戶收集的店鋪清單：
        ${relevantItems.map(item => `- ${item.title} (${item.category}): ${item.location || '未知地點'}, ${item.region || ''}`).join('\n')}
        
        請根據以上資訊，從清單中挑選合適的店鋪，規劃一個在 ${freeTime} 小時內可以完成的行程（包含來回交通時間）。
        請考慮地理位置的合理性。如果清單中的店鋪資訊不足，請利用你的知識（如果店名很有名）或給出合理的建議。
        
        輸出格式請使用 Markdown，包含：
        1. 行程總覽
        2. 詳細時間表
        3. 交通建議
        4. 溫馨提醒
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setItinerary(response.text || '無法生成行程，請稍後再試。');
    } catch (e) {
      console.error('Failed to plan itinerary', e);
      setItinerary('規劃過程中發生錯誤，請檢查網路連線或稍後再試。');
    } finally {
      setIsPlanning(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === Category.ALL || item.category === filter;
    const matchesRegion = regionFilter === 'ALL' || item.region === regionFilter;
    const matchesSubCategory = subCategoryFilter === 'ALL' || item.subCategory === subCategoryFilter;
    const matchesRating = ratingFilter === 0 || (item.rating && item.rating >= ratingFilter);
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'COMPLETED' ? item.isCompleted : !item.isCompleted);
    
    return matchesFilter && matchesRegion && matchesSubCategory && matchesRating && matchesStatus && matchesSearch;
  });

  const regions = Array.from(new Set(items.map(i => i.region).filter(Boolean))) as string[];
  const subCategories = Array.from(new Set(items.map(i => i.subCategory).filter(Boolean))) as string[];
  const foodSubCategories = ['日式料理', '美式料理', '台式料理', '咖啡廳'];

  const getCategoryTheme = (cat: Category) => {
    switch (cat) {
      case Category.FOOD: return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', icon: <Utensils className="w-4 h-4" />, label: '探店' };
      case Category.LEARNING: return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: <BookOpen className="w-4 h-4" />, label: '學習' };
      case Category.SHOPPING: return { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', icon: <ImageIcon className="w-4 h-4" />, label: '購物' };
      default: return { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-100', icon: <MoreHorizontal className="w-4 h-4" />, label: '其他' };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-black selection:text-white pb-24 sm:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">InfoCollector</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="hidden sm:flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 active:scale-95"
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{isUploading ? 'AI 分析中...' : '新增截圖'}</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
              }}
              className="hidden" 
              accept="image/*" 
            />
          </div>
        </div>
      </header>

        {/* Tabs - Top Level Categories */}
        <div className="sticky top-16 z-20 bg-white border-b border-zinc-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between sm:justify-start sm:gap-8 overflow-x-auto no-scrollbar">
              {[Category.ALL, Category.FOOD, Category.LEARNING, Category.SHOPPING, Category.OTHER].map((cat) => {
                const isActive = filter === cat;
                const label = cat === Category.ALL ? '全部' : getCategoryTheme(cat).label;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setFilter(cat);
                      setSubCategoryFilter('ALL');
                    }}
                    className={cn(
                      "relative py-4 px-2 text-sm font-bold transition-all whitespace-nowrap active:scale-95",
                      isActive ? "text-black" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    {label}
                    {isActive && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Toolbar - Secondary Filters */}
          <div className="flex flex-col gap-4 sm:gap-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="text"
                    placeholder="搜尋標題或內容..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 sm:py-2 bg-white border border-zinc-200 rounded-2xl sm:rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all shadow-sm sm:shadow-none"
                  />
                </div>
                <button 
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 sm:py-2 rounded-2xl sm:rounded-xl border transition-all text-sm font-medium",
                    isFiltersOpen ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">篩選</span>
                  {(regionFilter !== 'ALL' || subCategoryFilter !== 'ALL' || ratingFilter !== 0 || statusFilter !== 'ALL') && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
                <button 
                  onClick={() => setIsPlannerOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 sm:py-2 rounded-2xl sm:rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-all text-sm font-medium"
                >
                  <Route className="w-4 h-4" />
                  <span className="hidden sm:inline">規劃行程</span>
                </button>
              </div>
              
              <div className="hidden sm:flex items-center gap-2 bg-white p-1 border border-zinc-200 rounded-xl">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {isFiltersOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-zinc-100 rounded-3xl p-6 space-y-8 shadow-sm">
                    {/* Food Subcategories */}
                    {filter === Category.FOOD && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          <Utensils className="w-3.5 h-3.5" />
                          <span>料理類型</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['ALL', ...foodSubCategories, ...subCategories.filter(sc => !foodSubCategories.includes(sc))].map(sc => (
                            <button
                              key={sc}
                              onClick={() => setSubCategoryFilter(sc)}
                              className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95",
                                subCategoryFilter === sc 
                                  ? "bg-orange-500 text-white shadow-lg shadow-orange-200" 
                                  : "bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100"
                              )}
                            >
                              {sc === 'ALL' ? '全部' : sc}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                      {/* Status */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" />
                          <span>執行狀態</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'ALL', label: '全部' },
                            { id: 'PENDING', label: filter === Category.FOOD ? '未訪' : filter === Category.LEARNING ? '未讀' : filter === Category.SHOPPING ? '未買' : filter === Category.OTHER ? '未看/未讀' : '未完成' },
                            { id: 'COMPLETED', label: filter === Category.FOOD ? '已訪' : filter === Category.LEARNING ? '已讀' : filter === Category.SHOPPING ? '已買' : filter === Category.OTHER ? '已看/已讀' : '已完成' }
                          ].map(s => (
                            <button
                              key={s.id}
                              onClick={() => setStatusFilter(s.id as any)}
                              className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95",
                                statusFilter === s.id 
                                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" 
                                  : "bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100"
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Regions */}
                      {regions.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>地區範圍</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setRegionFilter('ALL')}
                              className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95",
                                regionFilter === 'ALL' 
                                  ? "bg-black text-white shadow-lg shadow-black/10" 
                                  : "bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100"
                              )}
                            >
                              全部
                            </button>
                            {regions.map(r => (
                              <button
                                key={r}
                                onClick={() => setRegionFilter(r)}
                                className={cn(
                                  "px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95",
                                  regionFilter === r 
                                    ? "bg-black text-white shadow-lg shadow-black/10" 
                                    : "bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ratings */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          <Star className="w-3.5 h-3.5" />
                          <span>星等評價</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[0, 3, 4, 5].map(r => (
                            <button
                              key={r}
                              onClick={() => setRatingFilter(r)}
                              className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95",
                                ratingFilter === r 
                                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-100" 
                                  : "bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100"
                              )}
                            >
                              {r === 0 ? '全部' : `${r}★+`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        {/* Grid */}
        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" : "flex flex-col gap-4"}>
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => {
              const theme = getCategoryTheme(item.category);
              return (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedItem(item)}
                  className={`group relative bg-white border border-zinc-200 rounded-2xl sm:rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-black/5 transition-all cursor-pointer active:scale-[0.98] ${viewMode === 'list' ? 'flex items-center p-4' : ''}`}
                >
                  <div className={viewMode === 'grid' ? "p-5 sm:p-6" : "flex-1 px-4"}>
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${theme.bg} ${theme.text} ${theme.border} text-[10px] font-bold uppercase tracking-wider`}>
                          {theme.icon}
                          <span>{item.subCategory || theme.label}</span>
                        </div>
                        {item.isCompleted && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            <Plus className="w-3 h-3 rotate-45" />
                            <span>{getCompleteLabel(item)}</span>
                            {item.rating && item.rating > 0 && (
                              <span className="ml-1 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                {item.rating}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={(e) => deleteItem(item.id, e)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold mb-2 line-clamp-1 group-hover:text-black transition-colors">{item.title}</h3>
                    
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed whitespace-pre-line">
                        {formatContent(item.content)}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {item.region && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-md text-[10px] font-medium">
                            <MapPin className="w-3 h-3" />
                            {item.region}
                          </div>
                        )}
                        {item.subwayStation && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-md text-[10px] font-medium">
                            <Train className="w-3 h-3" />
                            {item.subwayStation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {viewMode === 'grid' && (
                    <div className="px-5 sm:px-6 py-4 border-t border-zinc-50 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && !isUploading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900">沒有找到相關資訊</h3>
            <p className="text-sm text-zinc-500 mt-1 px-10">嘗試更換過濾條件或新增一張截圖吧！</p>
          </div>
        )}
      </main>

      {/* Floating Action Button (Mobile Only) */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
        >
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Itinerary Planner Modal */}
      <AnimatePresence>
        {isPlannerOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPlannerOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-2xl bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Route className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">AI 行程規劃</h2>
                    <p className="text-xs text-zinc-500">根據您的收藏清單規劃最佳路徑</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPlannerOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">出發地點</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text"
                        placeholder="例如：台北車站"
                        value={startLocation}
                        onChange={(e) => setStartLocation(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">空閒時間 (小時)</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="number"
                        placeholder="例如：4"
                        value={freeTime}
                        onChange={(e) => setFreeTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">行程偏好</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'SHOPPING', label: '純逛街', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                      { id: 'DINING', label: '吃飯', icon: <Utensils className="w-3.5 h-3.5" /> },
                      { id: 'BOTH', label: '逛街+吃飯', icon: <MoreHorizontal className="w-3.5 h-3.5" /> },
                      { id: 'ATTRACTIONS', label: '景點', icon: <MapPin className="w-3.5 h-3.5" /> }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setPlannerType(type.id as any)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all text-xs font-bold",
                          plannerType === type.id 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                            : "bg-zinc-50 text-zinc-500 border-zinc-100 hover:bg-zinc-100"
                        )}
                      >
                        {type.icon}
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handlePlanItinerary}
                  disabled={isPlanning || !startLocation}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isPlanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI 規劃中...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      開始規劃
                    </>
                  )}
                </button>

                {itinerary && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100"
                  >
                    <div className="prose prose-sm max-w-none prose-zinc prose-headings:text-zinc-900 prose-p:text-zinc-600 prose-strong:text-zinc-900">
                      <ReactMarkdown>{itinerary}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal / Bottom Sheet */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Drag Handle (Mobile Only) */}
              <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-12 h-1.5 bg-zinc-200 rounded-full" />
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {[Category.FOOD, Category.LEARNING, Category.SHOPPING, Category.OTHER].map((cat) => {
                        const theme = getCategoryTheme(cat);
                        const isCurrent = selectedItem.category === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => updateCategory(selectedItem.id, cat)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
                              isCurrent 
                                ? `${theme.bg} ${theme.text} ${theme.border} ring-2 ring-black/5` 
                                : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200"
                            )}
                          >
                            {theme.icon}
                            <span>{theme.label}</span>
                          </button>
                        );
                      })}
                      {selectedItem.subCategory && (
                        <span className="px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-zinc-200">
                          {selectedItem.subCategory}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{selectedItem.title}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors hidden sm:block"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">詳細內容</h4>
                      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        {formatContent(selectedItem.content)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">地點資訊</h4>
                      <div className="space-y-3">
                        {selectedItem.region && (
                          <div className="flex items-center gap-3 text-sm text-zinc-600">
                            <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase">地區</p>
                              <p className="font-semibold">{selectedItem.region}</p>
                            </div>
                          </div>
                        )}
                        {selectedItem.subwayStation && (
                          <div className="flex items-center gap-3 text-sm text-zinc-600">
                            <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Train className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase">最近捷運站</p>
                              <p className="font-semibold">{selectedItem.subwayStation}</p>
                            </div>
                          </div>
                        )}
                        {selectedItem.nearbyCollege && (
                          <div className="flex items-center gap-3 text-sm text-zinc-600">
                            <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase">附近學校</p>
                              <p className="font-semibold">{selectedItem.nearbyCollege}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedItem.link && (
                      <a 
                        href={selectedItem.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-4 bg-black text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-black/10"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {selectedItem.category === Category.FOOD || selectedItem.category === Category.SHOPPING 
                          ? '查看 Google Maps' 
                          : selectedItem.category === Category.LEARNING 
                            ? '前往學習資源' 
                            : '前往觀看/查看'}
                      </a>
                    )}

                    {/* Completion Section */}
                    <div className="pt-4 border-t border-zinc-100">
                      {!selectedItem.isCompleted && !isCompleting ? (
                        <button 
                          onClick={() => setIsCompleting(true)}
                          className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-bold hover:bg-emerald-100 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                          標記為{getCompleteLabel(selectedItem)}
                        </button>
                      ) : isCompleting ? (
                        <div className="space-y-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">填寫{getCompleteLabel(selectedItem)}資訊</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">評價星等</label>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-all active:scale-125"
                                  >
                                    <Star 
                                      className={`w-6 h-6 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-200'}`} 
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">日期</label>
                              <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-black"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">備註</label>
                              <textarea 
                                placeholder="寫下您的心得或備註..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-black min-h-[80px]"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setIsCompleting(false)}
                                className="flex-1 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all"
                              >
                                取消
                              </button>
                              <button 
                                onClick={() => toggleComplete(selectedItem.id, true)}
                                className="flex-1 py-2 bg-black text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-all"
                              >
                                確認
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                              <Plus className="w-3 h-3 rotate-45" />
                              {getCompleteLabel(selectedItem)}記錄
                            </h4>
                            <button 
                              onClick={() => toggleComplete(selectedItem.id, false)}
                              className="text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors"
                            >
                              撤銷標記
                            </button>
                          </div>
                          <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star}
                                className={`w-4 h-4 ${star <= (selectedItem.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-200'}`} 
                              />
                            ))}
                          </div>
                          <p className="text-xs text-emerald-700 font-bold mb-1">{selectedItem.completionDate}</p>
                          <p className="text-sm text-emerald-600 whitespace-pre-line">{selectedItem.completionNote || '無備註'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedItem.timestamp).toLocaleString()}
                  </div>
                  <div className="font-mono">ID: {selectedItem.id.slice(0, 8)}</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-zinc-100 rounded-full" />
              <div className="absolute inset-0 w-20 h-20 border-4 border-black border-t-transparent rounded-full animate-spin" />
            </div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-center"
            >
              <h2 className="text-xl font-bold tracking-tight">AI 正在分析您的截圖...</h2>
              <p className="text-sm text-zinc-500 mt-2">請稍候，我們正在為您提取關鍵資訊並分類。</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
