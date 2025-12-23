import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevLocationRef = useRef(location.pathname);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (location.pathname !== prevLocationRef.current) {
      setIsTransitioning(true);
      
      const transitionTimer = setTimeout(() => {
        setDisplayedChildren(children);
        prevLocationRef.current = location.pathname;
        
        requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      }, 120);
      
      return () => clearTimeout(transitionTimer);
    } else {
      setDisplayedChildren(children);
    }
  }, [location.pathname, children]);

  return (
    <div 
      className="w-full transition-opacity duration-150 ease-out"
      style={{ 
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
        transition: 'opacity 150ms cubic-bezier(0.22, 1, 0.36, 1), transform 150ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
    >
      {displayedChildren}
    </div>
  );
};

export default PageTransition;
