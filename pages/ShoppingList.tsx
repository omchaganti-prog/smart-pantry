import React, { useState, useEffect } from 'react';
import { getShoppingList, updateShoppingList, addToShoppingList, toggleShoppingItem, removeShoppingItem } from '../services/storageService';
import { ShoppingItem } from '../types';
import { Plus, Trash2, Check, ShoppingCart, Square, CheckSquare, X } from 'lucide-react';

const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  
  // Derived state
  const selectedCount = items.filter(i => i.checked).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  const refreshList = () => {
    setItems(getShoppingList());
  };

  useEffect(() => {
    refreshList();
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addToShoppingList(newItemName, '1 unit');
    setNewItemName('');
    refreshList();
  };

  const handleToggle = (id: string) => {
    toggleShoppingItem(id);
    refreshList();
  };

  const handleRemove = (id: string) => {
    removeShoppingItem(id);
    refreshList();
  };

  // --- Bulk Actions ---

  const handleSelectAll = () => {
    const newStatus = !allSelected;
    // Create new array with updated status
    const updatedItems = items.map(item => ({ ...item, checked: newStatus }));
    
    // Update State and Storage immediately
    setItems(updatedItems);
    updateShoppingList(updatedItems);
  };

  const handleDeleteSelected = () => {
    if (selectedCount === 0) return;
    
    const isAll = items.length > 0 && selectedCount === items.length;
    const confirmMessage = isAll 
      ? "Are you sure you want to delete ALL items?" 
      : `Delete ${selectedCount} selected items?`;

    if (window.confirm(confirmMessage)) {
      // Robust Logic: Filter out anything that is checked. 
      // If all are checked, this returns an empty array [].
      const remainingItems = items.filter(item => !item.checked);
      
      // Update Storage first to ensure persistence
      updateShoppingList(remainingItems);
      
      // Update UI
      setItems(remainingItems);
    }
  };

  return (
    <div className="p-4 pb-28 min-h-screen bg-[#FAFAF9] dark:bg-gray-900 transition-colors duration-300">
      <header data-walkthrough="shopping-list" className="flex items-center gap-3 mb-6 animate-fade-in">
        <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl shadow-warm text-white">
          <ShoppingCart size={24} fill="currentColor" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">Shopping List</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            {items.length} Items &bull; {items.length - selectedCount} Remaining
          </p>
        </div>
      </header>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-card mb-6 sticky top-4 z-20 animate-fade-in-up opacity-0" style={{ animationDelay: '0.05s' }}>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add milk, eggs..." 
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 pl-4 py-3 rounded-xl border-none focus:ring-0 text-gray-700 dark:text-white placeholder-gray-400 font-medium bg-transparent"
          />
          <button 
            type="submit"
            className="bg-gray-900 dark:bg-green-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-black dark:hover:bg-green-700 transition-all shadow-md tap-scale"
          >
            <Plus size={24} />
          </button>
        </form>
      </div>

      {/* Bulk Action Bar */}
      {items.length > 0 && (
        <div className="flex justify-between items-center px-2 mb-4 animate-in fade-in slide-in-from-top-2">
          <button 
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            {allSelected ? <CheckSquare size={18} className="text-green-500" /> : <Square size={18} />}
            Select All
          </button>

          {selectedCount > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 size={14} />
              {allSelected ? 'Delete All Items' : `Delete (${selectedCount})`}
            </button>
          )}
        </div>
      )}

      {/* Paper List */}
      <div className="relative bg-white dark:bg-gray-800 min-h-[400px] rounded-t-xl shadow-sm border border-gray-200 dark:border-gray-700 mx-1">
        {/* Paper Holes decoration */}
        <div className="absolute -top-3 left-0 w-full h-4 flex justify-evenly z-10">
           {[1,2,3,4,5,6].map(i => <div key={i} className="w-3 h-3 rounded-full bg-[#FAFAF9] dark:bg-gray-900 shadow-inner border border-gray-200 dark:border-gray-700"></div>)}
        </div>

        {/* Lines */}
        <div className="pt-6 pb-4 px-2">
          {items.length === 0 ? (
            <div className="text-center py-20 opacity-40">
               <p className="font-handwriting text-2xl text-gray-400 transform -rotate-6 mb-2">Cart is empty!</p>
               <p className="text-xs text-gray-400">Add items to get started</p>
            </div>
          ) : (
            items.map((item) => (
              <div 
                key={item.id} 
                className={`group flex items-center gap-3 py-4 border-b border-blue-50 dark:border-gray-700 transition-colors px-2 ${item.checked ? 'bg-gray-50/50 dark:bg-gray-700/50' : 'hover:bg-blue-50/30 dark:hover:bg-gray-700/30'}`}
              >
                <div 
                  onClick={() => handleToggle(item.id)}
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                    item.checked 
                      ? 'bg-green-500 border-green-500 text-white shadow-sm scale-105' 
                      : 'border-gray-300 dark:border-gray-500 text-transparent hover:border-green-400'
                  }`}
                >
                  <Check size={14} strokeWidth={4} />
                </div>
                
                <div className="flex-1 cursor-pointer" onClick={() => handleToggle(item.id)}>
                   <p className={`font-medium text-lg leading-none transition-all ${item.checked ? 'text-gray-400 dark:text-gray-500 line-through decoration-2 decoration-gray-200 dark:decoration-gray-600' : 'text-gray-700 dark:text-gray-200'}`}>
                     {item.name}
                   </p>
                   {item.amount !== '1 unit' && (
                     <p className={`text-xs mt-1 transition-colors ${item.checked ? 'text-gray-300 dark:text-gray-600' : 'text-blue-400 dark:text-blue-300 font-bold'}`}>
                       {item.amount}
                     </p>
                   )}
                </div>

                <button 
                  onClick={() => handleRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>
            ))
          )}
          
          {/* Empty Lines for aesthetic */}
          {[1,2,3].map(i => <div key={`empty-${i}`} className="h-14 border-b border-blue-50/50 dark:border-gray-700"></div>)}
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;