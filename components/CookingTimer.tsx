import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, X, Bell, BellOff, Plus, Minus, GripHorizontal } from 'lucide-react';

interface CookingTimerProps {
  suggestedMinutes?: number;
  stepName?: string;
  initialY?: number;
  onClose: () => void;
}

const CookingTimer: React.FC<CookingTimerProps> = ({ suggestedMinutes = 5, stepName, initialY, onClose }) => {
  const [totalSeconds, setTotalSeconds] = useState(suggestedMinutes * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(suggestedMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasInitialized = useRef(false);

  // Set initial position based on click location
  useEffect(() => {
    if (initialY !== undefined && !hasInitialized.current) {
      hasInitialized.current = true;
      // Clamp to keep timer visible (at least 20px from top, 200px from bottom)
      const maxY = window.innerHeight - 280;
      const clampedY = Math.max(20, Math.min(initialY - 80, maxY));
      setPosition({ x: 0, y: clampedY });
    }
  }, [initialY]);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleA0MT53J8XxkEAhEmtrskGEMCzaV0+mQWxIKPJTV5YxhFw9AnNHfkWMYCz2f1uGOYxkNP5zS3pFkGQ0+ndPdjWMZDT6d0t2NZBkNPp3T3Y1kGQ0+ndPdjWQZDT6d092NZBkNPp3T3Y1kGQ0+ndPdjWQZDQ==');
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning && remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsComplete(true);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Handle dragging
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY, posX: position.x, posY: position.y };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove, { passive: true });
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: true });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Cleanup drag state on unmount
  useEffect(() => {
    return () => {
      setIsDragging(false);
    };
  }, []);

  const handleTimerComplete = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, [soundEnabled]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (remainingSeconds > 0) {
      setIsRunning(true);
      setIsComplete(false);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
    setIsComplete(false);
  };

  const adjustTime = (deltaMinutes: number) => {
    if (!isRunning) {
      const newSeconds = Math.max(60, totalSeconds + deltaMinutes * 60);
      setTotalSeconds(newSeconds);
      setRemainingSeconds(newSeconds);
    }
  };

  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;

  return (
    <div 
      ref={dragRef}
      className="fixed z-50 w-[calc(100%-2rem)] max-w-xs"
      style={{ 
        left: `calc(50% + ${position.x}px)`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)'
      }}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border-2 transition-all duration-300 ease-out ${isComplete ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'} overflow-hidden`}>
        {/* Drag Handle */}
        <div 
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className={`flex items-center justify-center py-2 bg-gray-50 dark:bg-gray-700/50 cursor-grab active:cursor-grabbing border-b border-gray-100 dark:border-gray-700 ${isDragging ? 'cursor-grabbing' : ''}`}
        >
          <GripHorizontal size={18} className="text-gray-400" />
        </div>

        <div className="relative">
          <div 
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isComplete ? 'bg-green-100 dark:bg-green-900/40' : 'bg-orange-100 dark:bg-orange-900/40'}`}>
                <Timer size={18} className={isComplete ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">Cooking Timer</h3>
                {stepName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">{stepName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {soundEnabled ? (
                  <Bell size={16} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <BellOff size={16} className="text-gray-400 dark:text-gray-500" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={16} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {isComplete ? (
            <div className="text-center py-3">
              <div className="text-3xl mb-1">🍽️</div>
              <p className="font-bold text-green-600 dark:text-green-400">Step complete!</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Time to move on</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-3">
                {!isRunning && (
                  <button
                    onClick={() => adjustTime(-1)}
                    className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors tap-scale"
                  >
                    <Minus size={16} className="text-gray-600 dark:text-gray-300" />
                  </button>
                )}
                
                <div className={`text-4xl font-bold tracking-tight ${isRunning ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                  {formatTime(remainingSeconds)}
                </div>
                
                {!isRunning && (
                  <button
                    onClick={() => adjustTime(1)}
                    className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors tap-scale"
                  >
                    <Plus size={16} className="text-gray-600 dark:text-gray-300" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {isRunning ? (
                  <button
                    onClick={handlePause}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 tap-scale text-sm"
                  >
                    <Pause size={16} />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 tap-scale text-sm"
                  >
                    <Play size={16} />
                    {remainingSeconds < totalSeconds ? 'Resume' : 'Start'}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold flex items-center justify-center gap-2 tap-scale hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </>
          )}

          {isComplete && (
            <button
              onClick={handleReset}
              className="w-full py-2.5 mt-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 tap-scale text-sm"
            >
              <RotateCcw size={16} />
              Start New Timer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookingTimer;
