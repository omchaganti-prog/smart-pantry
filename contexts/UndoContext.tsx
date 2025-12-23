import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

const UNDO_TIMEOUT_MS = 30000;

interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
  onExpire?: () => void;
  createdAt: number;
}

interface UndoContextType {
  currentUndo: UndoAction | null;
  remainingTime: number;
  showUndo: (message: string, onUndo: () => void, onExpire?: () => void) => void;
  executeUndo: () => void;
  dismissUndo: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export const UndoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUndo, setCurrentUndo] = useState<UndoAction | null>(null);
  const [remainingTime, setRemainingTime] = useState(UNDO_TIMEOUT_MS);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const dismissUndo = useCallback(() => {
    clearTimers();
    if (currentUndo?.onExpire) {
      currentUndo.onExpire();
    }
    setCurrentUndo(null);
    setRemainingTime(UNDO_TIMEOUT_MS);
  }, [currentUndo, clearTimers]);

  const showUndo = useCallback((message: string, onUndo: () => void, onExpire?: () => void) => {
    clearTimers();
    
    if (currentUndo?.onExpire) {
      currentUndo.onExpire();
    }

    const newUndo: UndoAction = {
      id: Date.now().toString(),
      message,
      onUndo,
      onExpire,
      createdAt: Date.now()
    };

    setCurrentUndo(newUndo);
    setRemainingTime(UNDO_TIMEOUT_MS);

    intervalRef.current = setInterval(() => {
      setRemainingTime(prev => {
        const newTime = prev - 100;
        return newTime >= 0 ? newTime : 0;
      });
    }, 100);

    timeoutRef.current = setTimeout(() => {
      clearTimers();
      if (onExpire) {
        onExpire();
      }
      setCurrentUndo(null);
      setRemainingTime(UNDO_TIMEOUT_MS);
    }, UNDO_TIMEOUT_MS);
  }, [currentUndo, clearTimers]);

  const executeUndo = useCallback(() => {
    if (currentUndo) {
      clearTimers();
      currentUndo.onUndo();
      setCurrentUndo(null);
      setRemainingTime(UNDO_TIMEOUT_MS);
    }
  }, [currentUndo, clearTimers]);

  return (
    <UndoContext.Provider value={{
      currentUndo,
      remainingTime,
      showUndo,
      executeUndo,
      dismissUndo
    }}>
      {children}
    </UndoContext.Provider>
  );
};

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (context === undefined) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
};
