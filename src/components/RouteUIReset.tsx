import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets global UI side-effects on route changes.
 *
 * Fixes cases where overlays (Dialog/Sheet/Drawer/Framer Motion) or scroll-lock styles
 * can survive unmounts and keep the UI blurred/dimmed.
 */
export function RouteUIReset() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render to avoid cleaning up on initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const cleanup = () => {
      const body = document.body;
      const html = document.documentElement;

      // Reset body scroll locks
      body.style.removeProperty("overflow");
      body.style.removeProperty("padding-right");
      body.style.removeProperty("pointer-events");
      body.style.removeProperty("position");
      body.style.removeProperty("top");
      body.style.removeProperty("left");
      body.style.removeProperty("right");

      body.classList.remove("overflow-hidden");
      body.removeAttribute("data-scroll-locked");
      body.removeAttribute("data-vaul-drawer-open");

      html.style.removeProperty("overflow");

      // Reset any inline filters on root
      const root = document.getElementById("root");
      if (root) {
        root.style.removeProperty("filter");
        root.style.removeProperty("backdrop-filter");
        root.style.removeProperty("transform");
        root.style.removeProperty("will-change");
      }

      // Remove ALL elements with backdrop-blur that are fixed/absolute overlays
      // This catches Framer Motion animated overlays that don't unmount properly
      const overlays = document.querySelectorAll<HTMLElement>(
        '[class*="backdrop-blur"], [class*="bg-background/80"], [style*="backdrop-filter"]'
      );
      
      overlays.forEach((el) => {
        const style = window.getComputedStyle(el);
        const position = style.position;
        
        // Only remove fixed/absolute positioned overlays (not inline blurred elements)
        if (position === "fixed" || position === "absolute") {
          const rect = el.getBoundingClientRect();
          const isLargeOverlay = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;
          
          // Remove large overlays (likely modal backdrops)
          if (isLargeOverlay) {
            el.remove();
          }
        }
      });

      // Also target Framer Motion's presence elements that might be stuck
      const motionElements = document.querySelectorAll<HTMLElement>(
        '[data-framer-portal-id], [class*="framer"]'
      );
      motionElements.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.position === "fixed" && style.backdropFilter !== "none") {
          el.remove();
        }
      });

      // Dispatch Escape to close any remaining open overlays
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    };

    // Run cleanup immediately
    cleanup();
    
    // Run again after a short delay to catch async-mounted overlays
    const timeoutId = setTimeout(cleanup, 100);

    return () => clearTimeout(timeoutId);
  }, [location.key]);

  return null;
}
