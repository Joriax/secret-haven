import { useState, useEffect, useRef, useCallback } from 'react';

interface LazyImageOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook for lazy loading images using Intersection Observer
 * Returns ref to attach to element and isInView state
 */
export function useLazyImage(options: LazyImageOptions = {}) {
  const { threshold = 0.1, rootMargin = '100px', triggerOnce = true } = options;
  const [isInView, setIsInView] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If already loaded and triggerOnce, skip
    if (triggerOnce && hasLoaded) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setHasLoaded(true);
            if (triggerOnce && observerRef.current) {
              observerRef.current.disconnect();
            }
          } else if (!triggerOnce) {
            setIsInView(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, rootMargin, triggerOnce, hasLoaded]);

  return { ref, isInView, hasLoaded };
}

/**
 * Hook for managing multiple lazy-loaded items with a shared observer
 * More performant for large grids
 */
export function useLazyImageBatch(itemCount: number, options: LazyImageOptions = {}) {
  const { threshold = 0.1, rootMargin = '200px' } = options;
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-lazy-id');
          if (!id) return;

          if (entry.isIntersecting) {
            setVisibleItems((prev) => new Set(prev).add(id));
          }
        });
      },
      { threshold, rootMargin }
    );

    // Observe all registered elements
    elementsRef.current.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, itemCount]);

  const registerElement = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      element.setAttribute('data-lazy-id', id);
      elementsRef.current.set(id, element);
      observerRef.current?.observe(element);
    } else {
      const existing = elementsRef.current.get(id);
      if (existing) {
        observerRef.current?.unobserve(existing);
        elementsRef.current.delete(id);
      }
    }
  }, []);

  const isVisible = useCallback((id: string) => visibleItems.has(id), [visibleItems]);

  return { registerElement, isVisible, visibleItems };
}
