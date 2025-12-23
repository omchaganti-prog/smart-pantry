import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const WALKTHROUGH_KEY = 'smartpantry_walkthrough_completed';
const WALKTHROUGH_PROGRESS_KEY = 'smartpantry_walkthrough_step';

export interface WalkthroughStep {
  id: number;
  title: string;
  description: string;
  targetSelector: string;
  waitForAction: 'tap' | 'scroll' | 'open' | 'any';
  emoji?: string;
  arrowPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 0,
    title: "Welcome to SmartPantry!",
    description: "Let's take a quick tour. Tap highlighted areas to continue.",
    targetSelector: "",
    waitForAction: 'any',
    emoji: "👋"
  },
  {
    id: 1,
    title: "Head to Chef",
    description: "This is where the magic happens! Tap the Chef tab below.",
    targetSelector: "[data-walkthrough='nav-chef']",
    waitForAction: 'tap',
    emoji: "👨‍🍳",
    arrowPosition: 'top'
  },
  {
    id: 2,
    title: "Generate Recipes",
    description: "Tap 'Surprise Me' to get AI recipe suggestions based on your pantry.",
    targetSelector: "[data-walkthrough='surprise-me']",
    waitForAction: 'tap',
    emoji: "🍽️",
    arrowPosition: 'bottom'
  },
  {
    id: 3,
    title: "Filter Your Recipes",
    description: "Use Preferences to control what recipes you see. Try opening it.",
    targetSelector: "[data-walkthrough='preferences-btn']",
    waitForAction: 'tap',
    emoji: "🎯",
    arrowPosition: 'bottom'
  },
  {
    id: 4,
    title: "Cooking Mode",
    description: "Pick your cooking style - Quick, Healthy, Budget & more.",
    targetSelector: "[data-walkthrough='mode-selector']",
    waitForAction: 'tap',
    emoji: "🎚️",
    arrowPosition: 'top'
  },
  {
    id: 5,
    title: "Your Pantry",
    description: "Track ingredients you have at home. Tap Pantry to continue.",
    targetSelector: "[data-walkthrough='nav-pantry']",
    waitForAction: 'tap',
    emoji: "🥬",
    arrowPosition: 'top'
  },
  {
    id: 6,
    title: "Shopping Cart",
    description: "Missing ingredients go here automatically. Tap to check it out.",
    targetSelector: "[data-walkthrough='nav-cart']",
    waitForAction: 'tap',
    emoji: "🛒",
    arrowPosition: 'top'
  },
  {
    id: 7,
    title: "Settings & Allergies",
    description: "Set your allergies and preferences here. Tap More to continue.",
    targetSelector: "[data-walkthrough='nav-more']",
    waitForAction: 'tap',
    emoji: "⚙️",
    arrowPosition: 'top'
  },
  {
    id: 8,
    title: "You're All Set!",
    description: "Happy cooking! Explore and enjoy your personalized recipes.",
    targetSelector: "",
    waitForAction: 'any',
    emoji: "🍳"
  }
];

interface WalkthroughContextType {
  hasCompletedWalkthrough: boolean;
  isWalkthroughActive: boolean;
  currentStep: number;
  currentStepData: WalkthroughStep | null;
  totalSteps: number;
  startWalkthrough: () => void;
  advanceStep: () => void;
  skipWalkthrough: () => void;
  completeWalkthrough: () => void;
  notifyInteraction: (selector: string) => void;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export const WalkthroughProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hasCompletedWalkthrough, setHasCompletedWalkthrough] = useState<boolean>(() => {
    return localStorage.getItem(WALKTHROUGH_KEY) === 'true';
  });
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem(WALKTHROUGH_PROGRESS_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const currentStepData = isWalkthroughActive ? WALKTHROUGH_STEPS[currentStep] : null;
  const totalSteps = WALKTHROUGH_STEPS.length;

  useEffect(() => {
    if (isWalkthroughActive) {
      localStorage.setItem(WALKTHROUGH_PROGRESS_KEY, currentStep.toString());
    }
  }, [currentStep, isWalkthroughActive]);

  const startWalkthrough = useCallback(() => {
    localStorage.removeItem(WALKTHROUGH_KEY);
    localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY);
    setHasCompletedWalkthrough(false);
    setCurrentStep(0);
    setIsWalkthroughActive(true);
  }, []);

  const advanceStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsWalkthroughActive(false);
      setHasCompletedWalkthrough(true);
      localStorage.setItem(WALKTHROUGH_KEY, 'true');
      localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY);
    }
  }, [currentStep, totalSteps]);

  const completeWalkthrough = useCallback(() => {
    setIsWalkthroughActive(false);
    setHasCompletedWalkthrough(true);
    localStorage.setItem(WALKTHROUGH_KEY, 'true');
    localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY);
  }, []);

  const skipWalkthrough = useCallback(() => {
    setIsWalkthroughActive(false);
    setHasCompletedWalkthrough(true);
    localStorage.setItem(WALKTHROUGH_KEY, 'true');
    localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY);
  }, []);

  const notifyInteraction = useCallback((selector: string) => {
    if (!isWalkthroughActive || !currentStepData) return;
    
    if (currentStepData.waitForAction === 'any') {
      advanceStep();
      return;
    }
    
    if (currentStepData.targetSelector && selector === currentStepData.targetSelector) {
      setTimeout(() => advanceStep(), 300);
    }
  }, [isWalkthroughActive, currentStepData, advanceStep]);

  return (
    <WalkthroughContext.Provider value={{
      hasCompletedWalkthrough,
      isWalkthroughActive,
      currentStep,
      currentStepData,
      totalSteps,
      startWalkthrough,
      advanceStep,
      skipWalkthrough,
      completeWalkthrough,
      notifyInteraction
    }}>
      {children}
    </WalkthroughContext.Provider>
  );
};

export const useWalkthrough = () => {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
};
