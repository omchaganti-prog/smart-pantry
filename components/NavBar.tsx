import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ScanLine, 
  Utensils, 
  List, 
  ShoppingCart, 
  Calendar, 
  User, 
  Menu, 
  X, 
  ChefHat, 
  Leaf,
  MoreHorizontal,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useWalkthrough } from '../contexts/WalkthroughContext';

interface NavItemConfig {
  path: string;
  label: string;
  icon: React.ElementType;
  color?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/pantry', label: 'Pantry', icon: List },
  { path: '/recipes', label: 'Chef', icon: Utensils },
  { path: '/shopping', label: 'Shop', icon: ShoppingCart },
  { path: '/planner', label: 'Plan', icon: Calendar },
  { path: '/profile', label: 'Profile', icon: User },
];

const NavBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const { accentColors } = useTheme();
  const { notifyInteraction, isWalkthroughActive } = useWalkthrough();

  const getWalkthroughAttr = (path: string) => {
    switch(path) {
      case '/pantry': return 'nav-pantry';
      case '/shopping': return 'nav-cart';
      case '/recipes': return 'nav-chef';
      default: return undefined;
    }
  };

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchEndY - touchStartY.current;
    
    if (Math.abs(diff) > 30) {
      if (diff > 0 && !isCollapsed) {
        setIsCollapsed(true);
      } else if (diff < 0 && isCollapsed) {
        setIsCollapsed(false);
      }
    }
  };

  const VISIBLE_SLOTS = 4;
  const needsMore = NAV_ITEMS.length > VISIBLE_SLOTS;
  const leftItems = NAV_ITEMS.slice(0, 2);
  const rightItemsStartIndex = 2;
  const rightItemsCount = needsMore ? VISIBLE_SLOTS - 1 - leftItems.length : 2; 
  const rightItems = NAV_ITEMS.slice(rightItemsStartIndex, rightItemsStartIndex + rightItemsCount);
  const overflowItems = needsMore ? NAV_ITEMS.slice(rightItemsStartIndex + rightItemsCount) : [];
  const isOverflowActive = overflowItems.some(item => item.path === location.pathname) || location.pathname === '/settings';

  const renderNavItem = (item: NavItemConfig) => {
    const isActive = location.pathname === item.path;
    const walkthroughAttr = getWalkthroughAttr(item.path);
    
    const handleClick = () => {
      if (walkthroughAttr && isWalkthroughActive) {
        notifyInteraction(`[data-walkthrough='${walkthroughAttr}']`);
      }
    };
    
    return (
      <NavLink 
        key={item.path}
        to={item.path} 
        data-walkthrough={walkthroughAttr}
        onClick={handleClick}
        className={`flex flex-col items-center justify-center space-y-1 transition-all duration-200 ease-out w-12 tap-scale ${
          isActive 
            ? 'scale-110 font-bold' 
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
        style={isActive ? { color: accentColors.primary } : undefined}
      >
        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[10px] font-medium">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 bg-black/20 dark:bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      <div 
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 transition-all duration-300 transform ${
          isMenuOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="font-bold text-gray-800 dark:text-white text-lg">Menu</h3>
            <button onClick={() => setIsMenuOpen(false)} className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">
              <X size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {overflowItems.map((item) => {
              const isItemActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 ease-out tap-scale ${
                    isItemActive 
                      ? 'ring-2' 
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  style={isItemActive ? { 
                    backgroundColor: `${accentColors.primary}15`,
                    color: accentColors.primary,
                    '--tw-ring-color': `${accentColors.primary}50`
                  } as React.CSSProperties : undefined}
                >
                  <item.icon size={24} className="mb-2" />
                  <span className="text-xs font-bold">{item.label}</span>
                </NavLink>
              );
            })}
            
            {(() => {
              const isSettingsActive = location.pathname === '/settings';
              return (
                <NavLink
                  to="/settings"
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 ease-out tap-scale ${
                    isSettingsActive 
                      ? 'ring-2' 
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  style={isSettingsActive ? { 
                    backgroundColor: `${accentColors.primary}15`,
                    color: accentColors.primary,
                    '--tw-ring-color': `${accentColors.primary}50`
                  } as React.CSSProperties : undefined}
                >
                  <Settings size={24} className="mb-2" />
                  <span className="text-xs font-bold">Settings</span>
                </NavLink>
              );
            })()}
          </div>
        </div>
        
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-r border-b border-gray-100 dark:border-gray-700"></div>
      </div>

      <div 
        ref={navRef}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 transition-transform duration-300 ease-in-out"
        style={{ 
          transform: `translateX(-50%) translateY(${isCollapsed ? 'calc(100% + 12px)' : '0px'})` 
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-6 z-30 flex items-center justify-center"
          style={{ touchAction: 'manipulation' }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCollapse();
            }}
            className="w-11 h-11 flex items-center justify-center cursor-pointer tap-scale"
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            style={{ pointerEvents: 'auto' }}
          >
            <div className="w-10 h-5 glass-nav rounded-t-lg border border-b-0 border-white/40 dark:border-gray-600/50 flex items-center justify-center backdrop-blur-md">
              <ChevronDown 
                size={12} 
                strokeWidth={2.5}
                className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ease-out pointer-events-none ${
                  isCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </div>
          </button>
        </div>

        <nav className="glass-nav rounded-3xl shadow-[0_8px_32px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgb(0,0,0,0.4)] border border-white/60 dark:border-gray-700/80 h-20 px-2 flex justify-between items-center relative">
          
          <div className="flex-1 flex justify-around items-center pr-8">
            {leftItems.map(renderNavItem)}
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
             <NavLink to="/scan" className="group">
               <div 
                 className={`flex items-center justify-center w-16 h-16 bg-gradient-to-tr ${accentColors.gradient} rounded-full shadow-lg dark:shadow-black/50 text-white transition-all duration-300 group-active:scale-95 group-hover:-translate-y-1 border-4 border-[#FAFAF9] dark:border-gray-900`}
                 style={{ boxShadow: `0 10px 25px -5px ${accentColors.primary}40` }}
               >
                 <ScanLine size={28} />
               </div>
             </NavLink>
          </div>

          <div className="flex-1 flex justify-around items-center pl-8">
            {rightItems.map(renderNavItem)}

            {needsMore && (
              <button 
                data-walkthrough="nav-more"
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  if (isWalkthroughActive) {
                    notifyInteraction("[data-walkthrough='nav-more']");
                  }
                }}
                className={`flex flex-col items-center justify-center space-y-1 transition-all duration-150 w-12 active:scale-95 ${
                  isMenuOpen || isOverflowActive
                    ? 'scale-110 font-bold' 
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                style={(isMenuOpen || isOverflowActive) ? { color: accentColors.primary } : undefined}
              >
                <div 
                  className={`p-1 rounded-full`}
                  style={isMenuOpen ? { backgroundColor: `${accentColors.primary}20` } : undefined}
                >
                  <MoreHorizontal size={20} strokeWidth={isMenuOpen ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-medium">More</span>
              </button>
            )}
          </div>

        </nav>
      </div>
    </>
  );
};

export default NavBar;
