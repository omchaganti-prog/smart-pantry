import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWalkthrough, WALKTHROUGH_STEPS } from '../contexts/WalkthroughContext';
import { X, ChefHat, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

const Walkthrough: React.FC = () => {
  const { 
    isWalkthroughActive, 
    currentStep, 
    currentStepData,
    totalSteps,
    advanceStep,
    goBackStep,
    skipWalkthrough,
    hasCompletedWalkthrough
  } = useWalkthrough();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const hasAutoStarted = useRef(false);
  const { startWalkthrough } = useWalkthrough();

  useEffect(() => {
    if (!hasAutoStarted.current && !hasCompletedWalkthrough) {
      hasAutoStarted.current = true;
      const timer = setTimeout(() => {
        startWalkthrough();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedWalkthrough, startWalkthrough]);

  // Take the user to the screen this step is about. Steps used to point at elements on
  // other pages, so the target simply wasn't in the DOM and the tour stalled.
  useEffect(() => {
    if (!isWalkthroughActive || !currentStepData?.route) return;
    if (location.pathname !== currentStepData.route) {
      navigate(currentStepData.route);
    }
  }, [isWalkthroughActive, currentStepData, location.pathname, navigate]);

  useEffect(() => {
    if (!isWalkthroughActive || !currentStepData) return;

    const step = currentStepData;

    const findAndHighlight = () => {
      if (step.targetSelector) {
        const element = document.querySelector(step.targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const padding = 12;
          
          setSpotlight({
            top: rect.top - padding + window.scrollY,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
          });

          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          
          let newStyle: React.CSSProperties = {
            position: 'fixed',
            maxWidth: '320px',
            width: '90%',
            zIndex: 210
          };

          if (rect.top > viewportHeight / 2) {
            newStyle.bottom = viewportHeight - rect.top + 20;
            newStyle.left = '50%';
            newStyle.transform = 'translateX(-50%)';
          } else {
            newStyle.top = rect.bottom + 20;
            newStyle.left = '50%';
            newStyle.transform = 'translateX(-50%)';
          }

          setTooltipStyle(newStyle);

          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setSpotlight(null);
          setTooltipStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxWidth: '320px',
            width: '90%',
            zIndex: 210
          });
        }
      } else {
        setSpotlight(null);
        setTooltipStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '320px',
          width: '90%',
          zIndex: 210
        });
      }
    };

    const timer = setTimeout(findAndHighlight, 200);
    
    const handleResize = () => findAndHighlight();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isWalkthroughActive, currentStep, currentStepData]);

  if (!isWalkthroughActive || !currentStepData) return null;

  const step = currentStepData;
  const isWelcome = step.id === 0;
  const isFinal = step.id === totalSteps - 1;
  const showArrow = spotlight && step.arrowPosition;

  const ArrowIcon = {
    top: ChevronUp,
    bottom: ChevronDown,
    left: ChevronLeft,
    right: ChevronRight
  }[step.arrowPosition || 'bottom'] || ChevronDown;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: 'none' }}>
      {/* Visual overlay with spotlight hole - no pointer events */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="walkthrough-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="20"
                fill="black"
                className="transition-all duration-300 ease-out"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#walkthrough-mask)"
        />
      </svg>

      {/* Blocker panels - block clicks everywhere EXCEPT the spotlight */}
      {spotlight && (
        <>
          {/* Top blocker */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, spotlight.top),
              pointerEvents: 'auto',
              zIndex: 199
            }}
          />
          {/* Bottom blocker */}
          <div 
            style={{
              position: 'fixed',
              top: spotlight.top + spotlight.height,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'auto',
              zIndex: 199
            }}
          />
          {/* Left blocker */}
          <div 
            style={{
              position: 'fixed',
              top: spotlight.top,
              left: 0,
              width: Math.max(0, spotlight.left),
              height: spotlight.height,
              pointerEvents: 'auto',
              zIndex: 199
            }}
          />
          {/* Right blocker */}
          <div 
            style={{
              position: 'fixed',
              top: spotlight.top,
              left: spotlight.left + spotlight.width,
              right: 0,
              height: spotlight.height,
              pointerEvents: 'auto',
              zIndex: 199
            }}
          />
        </>
      )}

      {/* When no spotlight, block the entire screen */}
      {!spotlight && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'auto',
            zIndex: 199
          }}
        />
      )}

      {spotlight && (
        <>
          <div
            className="absolute rounded-[20px] pointer-events-none transition-all duration-300 ease-out animate-pulse-ring"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.6), 0 0 30px rgba(34, 197, 94, 0.4)',
              zIndex: 201
            }}
          />
          
          {showArrow && (
            <div 
              className="absolute animate-bounce-subtle pointer-events-none"
              style={{
                ...(step.arrowPosition === 'bottom' && {
                  top: spotlight.top - 40,
                  left: spotlight.left + spotlight.width / 2 - 16
                }),
                ...(step.arrowPosition === 'top' && {
                  top: spotlight.top + spotlight.height + 8,
                  left: spotlight.left + spotlight.width / 2 - 16
                }),
                zIndex: 202
              }}
            >
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <ArrowIcon size={20} className="text-white" />
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ ...tooltipStyle, pointerEvents: 'auto' }}>
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <button
            onClick={skipWalkthrough}
            className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
          >
            <X size={18} />
          </button>

          <div className="p-5 pt-6 text-center">
            {isWelcome && (
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 flex items-center justify-center text-green-600 dark:text-green-400 shadow-lg">
                <ChefHat size={32} />
              </div>
            )}

            {step.emoji && !isWelcome && (
              <div className="text-3xl mb-2">{step.emoji}</div>
            )}

            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
              {step.title}
            </h2>

            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
              {step.description}
            </p>

            <div className="flex items-center justify-center gap-1 mb-4">
              {WALKTHROUGH_STEPS.map((_, index) => (
                <div 
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep 
                      ? 'w-4 bg-green-500' 
                      : index < currentStep 
                        ? 'w-1.5 bg-green-300 dark:bg-green-700' 
                        : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Every step can be advanced from here. Previously only the first and last
                had a button, so any step whose target was missing — or whose target
                nothing wired up to notifyInteraction — left the tour stuck behind a
                full-screen blocker with only "Skip tour" as a way out. */}
            <div className="flex items-center gap-2">
              {!isWelcome && (
                <button
                  onClick={goBackStep}
                  className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm tap-scale hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={isFinal ? skipWalkthrough : advanceStep}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-green-500/30 transition-all duration-200 ease-out hover:shadow-xl tap-scale"
              >
                {isFinal ? "Start Cooking!" : isWelcome ? "Let's Go!" : "Next"}
              </button>
            </div>

            {!isWelcome && !isFinal && spotlight && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Tap the highlighted area, or use Next
              </p>
            )}

            <button
              onClick={skipWalkthrough}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Skip tour
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.6), 0 0 30px rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.3), 0 0 40px rgba(34, 197, 94, 0.6); }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s ease-in-out infinite;
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Walkthrough;
