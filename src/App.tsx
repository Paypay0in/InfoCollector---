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
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum Category {
  FOOD = 'FOOD',
  LEARNING = 'LEARNING',
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
}

const App: React.FC = () => {
  const [items, setItems] = useState<CollectedItem[]>([]);
  const [filter, setFilter] = useState<Category>(Category.ALL);
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CollectedItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const matchesFilter = filter === Category.ALL || item.category === filter;
    const matchesRegion = regionFilter === 'ALL' || item.region === regionFilter;
    const matchesSubCategory = subCategoryFilter === 'ALL' || item.subCategory === subCategoryFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesRegion && matchesSubCategory && matchesSearch;
  });

  const regions = Array.from(new Set(items.map(i => i.region).filter(Boolean))) as string[];
  const subCategories = Array.from(new Set(items.map(i => i.subCategory).filter(Boolean))) as string[];

  const getCategoryTheme = (cat: Category) => {
    switch (cat) {
      case Category.FOOD: return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', icon: <Utensils className="w-4 h-4" /> };
      case Category.LEARNING: return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: <BookOpen className="w-4 h-4" /> };
      default: return { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-100', icon: <MoreHorizontal className="w-4 h-4" /> };
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:gap-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text"
                placeholder="搜尋標題或內容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 sm:py-2 bg-white border border-zinc-200 rounded-2xl sm:rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all shadow-sm sm:shadow-none"
              />
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

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-zinc-200 rounded-full text-xs font-medium shrink-0">
                <Filter className="w-3 h-3 text-zinc-400" />
                <span className="text-zinc-500 mr-1">分類:</span>
                {Object.values(Category).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`px-3 py-1 rounded-md transition-all whitespace-nowrap ${filter === cat ? 'bg-black text-white' : 'hover:bg-zinc-100 text-zinc-600'}`}
                  >
                    {cat === Category.ALL ? '全部' : cat === Category.FOOD ? '探店' : cat === Category.LEARNING ? '學習' : '其他'}
                  </button>
                ))}
              </div>

              {regions.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-zinc-200 rounded-full text-xs font-medium shrink-0">
                  <MapPin className="w-3 h-3 text-zinc-400" />
                  <span className="text-zinc-500 mr-1">地區:</span>
                  <select 
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer pr-2"
                  >
                    <option value="ALL">全部</option>
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
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
                      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${theme.bg} ${theme.text} ${theme.border} text-[10px] font-bold uppercase tracking-wider`}>
                        {theme.icon}
                        <span>{item.subCategory || item.category}</span>
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
                        {item.content}
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
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {selectedItem.category}
                      </span>
                      {selectedItem.subCategory && (
                        <span className="px-3 py-1 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-widest">
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
                        {selectedItem.content}
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
                        查看 Google Maps
                      </a>
                    )}
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
