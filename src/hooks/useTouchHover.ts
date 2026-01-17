import { useState, useCallback } from 'react';
import { useIsMobile } from './use-mobile';

/**
 * Hook to handle touch-friendly hover states for mobile devices.
 * On mobile: tap toggles active state, tap outside deactivates
 * On desktop: uses regular hover behavior
 */
export function useTouchHover() {
  const isMobile = useIsMobile();
  const [isActive, setIsActive] = useState(false);

  const handleTouchStart = useCallback(() => {
    if (isMobile) {
      setIsActive(prev => !prev);
    }
  }, [isMobile]);

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) {
      setIsActive(true);
    }
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) {
      setIsActive(false);
    }
  }, [isMobile]);

  // Deactivate on blur/outside interaction
  const handleBlur = useCallback(() => {
    setIsActive(false);
  }, []);

  return {
    isActive,
    isMobile,
    handlers: {
      onTouchStart: handleTouchStart,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onBlur: handleBlur,
    },
  };
}
