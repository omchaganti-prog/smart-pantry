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
  /** Screen this step belongs to. The tour navigates here so the target exists. */
  route?: string;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  // Ordered to follow how the app is actually used: fill the pantry first, then cook
  // from it, then shop for what's missing. The previous order asked you to generate
  // recipes before you had any ingredients, and only showed the pantry afterwards.
  {
    id: 0,
    title: "Welcome to SmartPantry!",
    description: "A quick tour of how it all fits together. Takes about a minute.",
    targetSelector: "",
    waitForAction: 'any',
    emoji: "👋"
  },
  {
    id: 1,
    title: "Start with your pantry",
    description: "Everything begins here — this is the food you already have at home.",
    targetSelector: "[data-walkthrough='nav-pantry']",
    waitForAction: 'tap',
    emoji: "🥬",
    arrowPosition: 'top',
    route: '/pantry'
  },
  {
    id: 2,
    title: "Add what you have",
    description: "Tap + to add an item by hand, or use the scanner to read a label and its expiry date for you.",
    targetSelector: "[data-walkthrough='pantry-add']",
    waitForAction: 'tap',
    emoji: "➕",
    arrowPosition: 'bottom',
    route: '/pantry'
  },
  {
    id: 3,
    title: "Now cook from it",
    description: "The Chef tab turns whatever is in your pantry into real recipes.",
    targetSelector: "[data-walkthrough='nav-chef']",
    waitForAction: 'tap',
    emoji: "👨‍🍳",
    arrowPosition: 'top',
    route: '/recipes'
  },
  {
    id: 4,
    title: "Generate recipes",
    description: "Tap 'Surprise Me' for ideas built around what you own — especially anything about to expire.",
    targetSelector: "[data-walkthrough='surprise-me']",
    waitForAction: 'tap',
    emoji: "🍽️",
    arrowPosition: 'bottom',
    route: '/recipes'
  },
  {
    id: 5,
    title: "Tune the results",
    description: "Preferences set your diet, cuisine and cooking mode — Quick, Healthy, Budget and more.",
    targetSelector: "[data-walkthrough='preferences-btn']",
    waitForAction: 'tap',
    emoji: "🎯",
    arrowPosition: 'bottom',
    route: '/recipes'
  },
  {
    id: 6,
    title: "Missing ingredients",
    description: "Anything a recipe needs but you don't have lands here, ready for the shop.",
    targetSelector: "[data-walkthrough='nav-cart']",
    waitForAction: 'tap',
    emoji: "🛒",
    arrowPosition: 'top',
    route: '/shopping'
  },
  {
    id: 7,
    title: "Tell it about you",
    description: "Set allergies, cooking skill and spice tolerance — every recipe gets filtered to match.",
    targetSelector: "[data-walkthrough='allergy-settings']",
    waitForAction: 'tap',
    emoji: "⚙️",
    route: '/settings'
  },
  {
    id: 8,
    title: "You're all set!",
    description: "Scan, cook, shop. Enjoy your kitchen.",
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
  goBackStep: () => void;
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

  const goBackStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

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
      goBackStep,
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
