import React, { useEffect, useState } from 'react';
import { getItems, deleteItem, saveItem } from '../services/storageService';
import { PantryItem, FoodCategory } from '../types';
import { Search, Trash2, Filter, LayoutGrid, List as ListIcon, Leaf, Plus, X } from 'lucide-react';
import { useWalkthrough } from '../contexts/WalkthroughContext';

const PantryList: React.FC = () => {
  const { notifyInteraction } = useWalkthrough();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: FoodCategory.PANTRY,
    quantity: 1,
    unit: 'unit',
    expiryDate: ''
  });

  useEffect(() => {
    setItems(getItems());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Remove this item from pantry?")) {
      deleteItem(id);
      setItems(getItems());
    }
  };

  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      alert('Please enter an item name');
      return;
    }

    const item: PantryItem = {
      id: crypto.randomUUID(),
      name: newItem.name.trim(),
      category: newItem.category,
      quantity: newItem.quantity,
      unit: newItem.unit,
      expiryDate: newItem.expiryDate || null,
      addedDate: new Date().toISOString()
    };

    saveItem(item);
    setItems(getItems());
    setShowAddModal(false);
    setNewItem({
      name: '',
      category: FoodCategory.PANTRY,
      quantity: 1,
      unit: 'unit',
      expiryDate: ''
    });
  };

  const filteredItems = items
    .filter(item => 
      (filterCategory === 'All' || item.category === filterCategory) &&
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by expiry date ascending (nulls last)
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const getStatusBadge = (days: number | null) => {
    if (days === null) return { color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300', text: 'No Date' };
    if (days < 0) return { color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', text: 'Expired' };
    if (days <= 3) return { color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', text: 'Use Soon' };
    return { color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', text: 'Fresh' };
  };

  const getCategoryEmoji = (cat: string) => {
    switch(cat) {
      case FoodCategory.PRODUCE: return '🥬';
      case FoodCategory.MEAT: return '🥩';
      case FoodCategory.DAIRY: return '🧀';
      case FoodCategory.FROZEN: return '🧊';
      case FoodCategory.BEVERAGES: return '🥤';
      case FoodCategory.SNACKS: return '🍪';
      default: return '🥫';
    }
  };

  return (
    <div className="p-4 pb-28 min-h-screen transition-colors duration-300">
      <div className="flex justify-between items-end mb-6 animate-fade-in">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">Pantry</h1>
        <div className="flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-card border border-gray-200 dark:border-gray-700">
           <button 
             onClick={() => setViewMode('list')}
             className={`p-2.5 rounded-lg transition-all tap-scale ${viewMode === 'list' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
           >
             <ListIcon size={18} />
           </button>
           <button 
             onClick={() => setViewMode('grid')}
             className={`p-2.5 rounded-lg transition-all tap-scale ${viewMode === 'grid' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
           >
             <LayoutGrid size={18} />
           </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6 sticky top-2 z-10 animate-fade-in-up opacity-0" style={{ animationDelay: '0.05s' }}>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search ingredients..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border-none shadow-card bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div className="relative">
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-full pl-4 pr-10 py-3 rounded-2xl border-none shadow-food bg-gradient-to-r from-green-600 to-green-500 text-white font-medium appearance-none outline-none cursor-pointer"
          >
            <option value="All">All</option>
            {Object.values(FoodCategory).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Filter className="absolute right-3 top-3.5 text-white/70 pointer-events-none" size={14} />
        </div>
      </div>

      {/* Content */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
           <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 flex items-center justify-center mb-4">
             <Leaf size={40} className="text-green-400 dark:text-green-600" />
           </div>
           <p className="text-gray-600 dark:text-gray-300 font-bold">Your pantry is empty</p>
           <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Scan items to get started</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-4" : "space-y-3"}>
          {filteredItems.map((item, index) => {
            const daysLeft = getDaysUntilExpiry(item.expiryDate);
            const status = getStatusBadge(daysLeft);
            
            if (viewMode === 'grid') {
              return (
                <div 
                  key={item.id} 
                  className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-card border border-gray-100 dark:border-gray-700 relative group hover:border-green-200 dark:hover:border-green-800 transition-all animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-3xl">{getCategoryEmoji(item.category)}</span>
                    <button 
                      onClick={(e) => handleDelete(item.id, e)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight mb-1 truncate">{item.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <span className="font-medium">{item.quantity} {item.unit}</span>
                  </div>
                  <div className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                    {status.text}
                  </div>
                </div>
              )
            }

            return (
              <div 
                key={item.id} 
                className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-green-200 dark:hover:border-green-800 transition-all animate-fade-in-up opacity-0"
                style={{ animationDelay: `${Math.min(index * 0.03, 0.2)}s` }}
              >
                <div className="flex items-center gap-4 overflow-hidden">
                   <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {item.thumbnail ? (
                         <img src={item.thumbnail} className="w-full h-full object-cover rounded-xl" alt="" />
                      ) : (
                         getCategoryEmoji(item.category)
                      )}
                   </div>
                   <div className="min-w-0">
                     <h3 className="font-bold text-gray-800 dark:text-white text-base truncate">{item.name}</h3>
                     <div className="flex items-center gap-2 mt-1">
                       <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${status.color}`}>
                         {status.text}
                       </span>
                       <span className="text-xs text-gray-400 font-medium">{item.quantity} {item.unit}</span>
                     </div>
                   </div>
                </div>
                <button 
                  onClick={(e) => handleDelete(item.id, e)}
                  className="p-2.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-all tap-scale bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Add Button */}
      <button
        data-walkthrough="pantry-add"
        onClick={() => {
          // the tour highlights this button; without this it could never be satisfied
          notifyInteraction("[data-walkthrough='pantry-add']");
          setShowAddModal(true);
        }}
        className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-green-600 to-green-500 text-white rounded-full shadow-food hover:shadow-lg transition-all hover:scale-110 tap-scale flex items-center justify-center z-50"
      >
        <Plus size={28} />
      </button>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[80vh] overflow-y-auto pb-24">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center z-10">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Item</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 pb-6">
              {/* Item Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Item Name *</label>
                <input 
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  placeholder="e.g., Milk, Eggs, Bread"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  autoFocus
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</label>
                <select 
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value as FoodCategory})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {Object.values(FoodCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                  <input 
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value) || 1})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unit</label>
                  <select 
                    value={newItem.unit}
                    onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="unit">unit</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="lb">lb</option>
                    <option value="oz">oz</option>
                    <option value="cup">cup</option>
                    <option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Expiry Date (Optional)</label>
                <input 
                  type="date"
                  value={newItem.expiryDate}
                  onChange={(e) => setNewItem({...newItem, expiryDate: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              {/* Action Buttons - Fixed at bottom */}
              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white dark:bg-gray-800 pb-4 -mb-4">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddItem}
                  className="flex-1 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PantryList;