import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Plus, 
  Utensils, 
  BookOpen, 
  MoreHorizontal, 
  Trash2, 
  MapPin, 
  ExternalLink,
  Search,
  Loader2,
  X,
  TrainFront,
  School,
  Map,
  Image as ImageIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeImage, Category, type CollectedItem } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [items, setItems] = useState<CollectedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL');
  const [regionFilter, setRegionFilter] = useState<string | 'ALL'>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<CollectedItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique regions and subcategories from items
  const regions = Array.from(new Set(items.map(item => item.region).filter(Boolean))) as string[];
  const subCategories = Array.from(new Set(items.filter(i => i.category === Category.FOOD).map(item => item.subCategory).filter(Boolean))) as string[];

  // Reset subCategory filter when main category changes
  useEffect(() => {
    if (filter !== Category.FOOD) {
      setSubCategoryFilter('ALL');
    }
  }, [filter]);

  // Load items from server
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    try {
      // 1. Image Compression Logic
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
            
            // Max width/height 1200px for AI analysis is plenty
            const MAX_SIZE = 1200;
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
            // Compress to JPEG with 0.7 quality
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
        };
      });

      const response = await fetch('/api/auto-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: compressedBase64 }),
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, get the text
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const responseData = await response.json();
      const { data: result, id } = responseData;
      
      const newItem: CollectedItem = {
        id,
        title: result.title || '未命名資訊',
        category: (result.category as Category) || Category.OTHER,
        subCategory: result.subCategory,
        content: result.content || '',
        location: result.location,
        region: result.region,
        subwayStation: result.subwayStation,
        nearbyCollege: result.nearbyCollege,
        link: result.link,
        timestamp: Date.now(),
      };

      setItems(prev => [newItem, ...prev]);
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

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'ALL' || item.category === filter;
    const matchesRegion = regionFilter === 'ALL' || item.region === regionFilter;
    const matchesSubCategory = subCategoryFilter === 'ALL' || item.subCategory === subCategoryFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesRegion && matchesSubCategory && matchesSearch;
  });

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
      case Category.FOOD: return <Utensils className="w-4 h-4" />;
      case Category.LEARNING: return <BookOpen className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (cat: Category) => {
    switch (cat) {
      case Category.FOOD: return '探店清單';
      case Category.LEARNING: return '學習內容';
      default: return '其他資訊';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 leading-none mb-1">InfoCollector</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Smart Knowledge Hub</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="搜尋標題或內容..."
                className="pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 w-64 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-md"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>上傳截圖</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {/* Filters */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setFilter('ALL')}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                filter === 'ALL' ? "bg-emerald-100 text-emerald-700" : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              )}
            >
              全部類別
            </button>
            <button 
              onClick={() => setFilter(Category.FOOD)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                filter === Category.FOOD ? "bg-orange-100 text-orange-700" : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              )}
            >
              <Utensils className="w-3.5 h-3.5" />
              探店清單
            </button>
            <button 
              onClick={() => setFilter(Category.LEARNING)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                filter === Category.LEARNING ? "bg-blue-100 text-blue-700" : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              學習內容
            </button>
            <button 
              onClick={() => setFilter(Category.OTHER)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                filter === Category.OTHER ? "bg-zinc-200 text-zinc-700" : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              )}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              其他
            </button>
          </div>

          {regions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mr-2">地區篩選:</span>
              <button 
                onClick={() => setRegionFilter('ALL')}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all",
                  regionFilter === 'ALL' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                )}
              >
                全部地區
              </button>
              {regions.map(region => (
                <button 
                  key={region}
                  onClick={() => setRegionFilter(region)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    regionFilter === region ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  )}
                >
                  {region}
                </button>
              ))}
            </div>
          )}

          {filter === Category.FOOD && subCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mr-2">類型篩選:</span>
              <button 
                onClick={() => setSubCategoryFilter('ALL')}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all",
                  subCategoryFilter === 'ALL' ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                )}
              >
                全部類型
              </button>
              {subCategories.map(subCat => (
                <button 
                  key={subCat}
                  onClick={() => setSubCategoryFilter(subCat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    subCategoryFilter === subCat ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                  )}
                >
                  {subCat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-10 h-10" />
            </div>
            <p className="text-lg font-medium">尚無相關資訊</p>
            <p className="text-sm">上傳截圖後，AI 將自動為您整理重點。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedItem(item)}
                  className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl hover:shadow-zinc-200 transition-all cursor-pointer flex flex-col p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm",
                        item.category === Category.FOOD ? "bg-orange-100 text-orange-700" :
                        item.category === Category.LEARNING ? "bg-blue-100 text-blue-700" :
                        "bg-zinc-100 text-zinc-700"
                      )}>
                        {getCategoryIcon(item.category)}
                        {getCategoryLabel(item.category)}
                      </span>
                      {item.region && (
                        <span className="px-2 py-1 bg-zinc-800 text-white rounded-full text-[9px] font-bold uppercase tracking-tight">
                          {item.region}
                        </span>
                      )}
                      {item.subCategory && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-[9px] font-bold uppercase tracking-tight border border-orange-100">
                          {item.subCategory}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-zinc-900 mb-3 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-zinc-500 whitespace-pre-wrap line-clamp-4 mb-6 leading-relaxed">
                      {item.content.replace(/\\n/g, '\n')}
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-zinc-50 flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        {item.subwayStation && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <TrainFront className="w-2.5 h-2.5" />
                            {item.subwayStation}
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={(e) => deleteItem(item.id, e)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-6 right-6 z-10 p-2 bg-zinc-100 rounded-full text-zinc-500 hover:text-zinc-900 shadow-sm transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-full p-10 overflow-y-auto flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <span className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5",
                    selectedItem.category === Category.FOOD ? "bg-orange-100 text-orange-700" :
                    selectedItem.category === Category.LEARNING ? "bg-blue-100 text-blue-700" :
                    "bg-zinc-100 text-zinc-700"
                  )}>
                    {getCategoryIcon(selectedItem.category)}
                    {getCategoryLabel(selectedItem.category)}
                  </span>
                  {selectedItem.region && (
                    <span className="px-3 py-1.5 bg-zinc-800 text-white rounded-full text-[10px] font-bold uppercase tracking-widest">
                      {selectedItem.region}
                    </span>
                  )}
                  {selectedItem.subCategory && (
                    <span className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-orange-100">
                      {selectedItem.subCategory}
                    </span>
                  )}
                  <span className="text-xs font-mono text-zinc-400">
                    {new Date(selectedItem.timestamp).toLocaleString()}
                  </span>
                </div>

                <h2 className="text-3xl font-bold text-zinc-900 mb-8 leading-tight">{selectedItem.title}</h2>

                <div className="space-y-8 flex-1">
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">重點摘要</h4>
                    <div className="text-zinc-700 leading-relaxed whitespace-pre-wrap font-medium text-base">
                      {selectedItem.content.replace(/\\n/g, '\n')}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {selectedItem.region && (
                      <div className="flex items-start gap-3">
                        <Map className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">地區 / 行政區</p>
                          <p className="text-zinc-900 font-semibold">{selectedItem.region}</p>
                        </div>
                      </div>
                    )}

                    {selectedItem.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">地點 / 店名</p>
                          <p className="text-zinc-900 font-semibold">{selectedItem.location}</p>
                        </div>
                      </div>
                    )}
                    
                    {selectedItem.subwayStation && (
                      <div className="flex items-start gap-3">
                        <TrainFront className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">最近捷運/地鐵站</p>
                          <p className="text-zinc-900 font-semibold">{selectedItem.subwayStation}</p>
                        </div>
                      </div>
                    )}

                    {selectedItem.nearbyCollege && (
                      <div className="flex items-start gap-3">
                        <School className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">附近大學/學院</p>
                          <p className="text-zinc-900 font-semibold">{selectedItem.nearbyCollege}</p>
                        </div>
                      </div>
                    )}

                    {selectedItem.link && (
                      <div className="flex items-start gap-3">
                        <ExternalLink className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">相關連結</p>
                          <a 
                            href={selectedItem.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-600 font-bold hover:underline break-all"
                          >
                            {selectedItem.link}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-zinc-100 flex gap-4">
                  <button 
                    onClick={(e) => {
                      deleteItem(selectedItem.id, e);
                      setSelectedItem(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-red-100 text-red-600 font-semibold hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    刪除此筆資訊
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white"
          >
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Upload className="w-8 h-8 text-emerald-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">AI 正在分析您的截圖...</h2>
            <p className="text-zinc-400 text-sm">請稍候，我們正在為您提取關鍵資訊並分類。</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
