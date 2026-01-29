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

      // IMPORTANT: Never remove DOM nodes here.
      // Removing portal/backdrop nodes can race with React unmount and cause:
      // "NotFoundError: The object can not be found here" (removeChild during commit).
      // Instead, neutralize potential stuck overlays by disabling their visuals + interactions.
      const overlays = document.querySelectorAll<HTMLElement>(
        '[class*="backdrop-blur"], [class*="bg-background/80"], [style*="backdrop-filter"], [data-radix-portal], [data-vaul-overlay]'
      );

      overlays.forEach((el) => {
        const style = window.getComputedStyle(el);
        const position = style.position;
        if (position !== 'fixed' && position !== 'absolute') return;

        const rect = el.getBoundingClientRect();
        const isLargeOverlay =
          rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;
        if (!isLargeOverlay) return;

        el.style.pointerEvents = 'none';
        el.style.opacity = '0';
        el.style.filter = 'none';
        // backdropFilter is not always writable via style in all browsers; safe-guard.
        try {
          (el.style as any).backdropFilter = 'none';
        } catch {
          // ignore
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
