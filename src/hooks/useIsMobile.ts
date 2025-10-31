import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1024; // Corresponds to 'lg' in Tailwind CSS

export function useIsMobile() {
  // Check for touch capabilities in addition to screen width
  const getIsMobile = () => {
    return window.innerWidth < MOBILE_BREAKPOINT || navigator.maxTouchPoints > 0;
  };

  const [isMobile, setIsMobile] = useState(getIsMobile());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(getIsMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isMobile;
}