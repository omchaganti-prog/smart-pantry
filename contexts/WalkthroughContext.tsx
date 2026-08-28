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
  /**
   * Steps that ask the user to actually DO something (scan an item, add one by hand).
   * Tapping the highlight pauses the tour and lifts the overlay so they can finish,
   * instead of advancing and navigating the screen out from under them.
   */
  pausesOnAction?: boolean;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  // Follows how the app is actually used: scan food in, see it in the pantry, cook from
  // it, then shop for what's missing. The original order asked you to generate recipes
  // before you had any ingredients, and introduced the pantry two steps later.
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
    title: "Scan your food in",
    description: "Point your camera at an item and it reads the name, category and expiry date off the label. Tap it to try — the tour waits for you.",
    targetSelector: "[data-walkthrough='nav-scan']",
    waitForAction: 'tap',
    emoji: "📷",
    arrowPosition: 'top',
    pausesOnAction: true
  },
  {
    id: 2,
    title: "It lands in your pantry",
    description: "Everything you scan shows up here, sorted so whatever expires first is at the top.",
    targetSelector: "[data-walkthrough='nav-pantry']",
    waitForAction: 'tap',
    emoji: "🥬",
    arrowPosition: 'top',
    route: '/pantry'
  },
  {
    id: 3,
    title: "Or add it by hand",
    description: "No label to scan? Tap + and add one now — the tour waits, and you can pick it back up when you're done.",
    targetSelector: "[data-walkthrough='pantry-add']",
    waitForAction: 'tap',
    emoji: "➕",
    arrowPosition: 'bottom',
    route: '/pantry',
    pausesOnAction: true
  },
  {
    id: 4,
    title: "Now cook from it",
    description: "The Chef tab turns whatever is in your pantry into real recipes.",
    targetSelector: "[data-walkthrough='nav-chef']",
    waitForAction: 'tap',
    emoji: "👨‍🍳",
    arrowPosition: 'top',
    route: '/recipes'
  },
  {
    id: 5,
    title: "Generate recipes",
    description: "Tap 'Surprise Me' for ideas built around what you own — especially anything about to expire.",
    targetSelector: "[data-walkthrough='surprise-me']",
    waitForAction: 'tap',
    emoji: "🍽️",
    arrowPosition: 'bottom',
    route: '/recipes'
  },
  {
    id: 6,
    title: "Tune the results",
    description: "Preferences set your diet, cuisine and cooking mode — Quick, Healthy, Budget and more.",
    targetSelector: "[data-walkthrough='preferences-btn']",
    waitForAction: 'tap',
    emoji: "🎯",
    arrowPosition: 'bottom',
    route: '/recipes'
  },
  {
    id: 7,
    title: "Missing ingredients",
    description: "Anything a recipe needs but you don't have lands here, ready for the shop.",
    targetSelector: "[data-walkthrough='shopping-list']",
    waitForAction: 'tap',
    emoji: "🛒",
    route: '/shopping'
  },
  {
    id: 8,
    title: "Tell it about you",
    description: "Open AI Chef here to set allergies, cooking skill and spice tolerance — every recipe gets filtered to match.",
    targetSelector: "[data-walkthrough='settings-tabs']",
    waitForAction: 'tap',
    emoji: "⚙️",
    route: '/settings'
  },
  {
    id: 9,
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
  isWalkthroughPaused: boolean;
  pauseWalkthrough: () => void;
  resumeWalkthrough: () => void;
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
  const [isWalkthroughPaused, setIsWalkthroughPaused] = useState(false);
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
    setIsWalkthroughPaused(false);
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

  const pauseWalkthrough = useCallback(() => {
    setIsWalkthroughPaused(true);
  }, []);

  // Resuming moves on: the user has just done the thing the step was asking for.
  const resumeWalkthrough = useCallback(() => {
    setIsWalkthroughPaused(false);
    advanceStep();
  }, [advanceStep]);

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
      // Action steps hand control back to the user rather than advancing, which would
      // navigate away mid-task (tapping + used to close the Add dialog instantly).
      if (currentStepData.pausesOnAction) {
        setIsWalkthroughPaused(true);
        return;
      }
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
      isWalkthroughPaused,
      pauseWalkthrough,
      resumeWalkthrough,
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
