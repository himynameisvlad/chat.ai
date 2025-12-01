import { useRef, useEffect } from 'react';

/**
 * Custom hook for automatic scrolling to bottom
 * Reusable hook following Single Responsibility Principle
 *
 * @param dependency - Value to watch for changes (e.g., messages array)
 * @returns Ref to attach to the scroll target element
 */
export function useAutoScroll<T>(dependency: T) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dependency]);

  return scrollRef;
}
