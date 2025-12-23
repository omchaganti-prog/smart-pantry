import React from 'react';
import { Undo2, X } from 'lucide-react';
import { useUndo } from '../contexts/UndoContext';

const UndoToast: React.FC = () => {
  const { currentUndo, remainingTime, executeUndo, dismissUndo } = useUndo();

  if (!currentUndo) return null;

  const progress = (remainingTime / 30000) * 100;
  const secondsLeft = Math.ceil(remainingTime / 1000);

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-slide-up">
      <div className="bg-gray-900 dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 dark:border-gray-600">
        <div 
          className="h-1 bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
        
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <Undo2 size={16} className="text-gray-400" />
            </div>
            <p className="text-white text-sm font-medium truncate">
              {currentUndo.message}
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={executeUndo}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors duration-150 tap-scale flex items-center gap-1.5"
            >
              UNDO
              <span className="text-green-200 text-[10px]">({secondsLeft}s)</span>
            </button>
            
            <button
              onClick={dismissUndo}
              className="p-1.5 hover:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UndoToast;
