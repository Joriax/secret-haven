import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets global UI side-effects on route changes.
 *
 * Fixes cases where overlays (Dialog/Sheet/Drawer) or scroll-lock styles
 * can survive unmounts and keep the UI blurred/dimmed.
 */
export function RouteUIReset() {
  const location = useLocation();

  useEffect(() => {
    const resetScrollLocks = () => {
      const body = document.body;
      const html = document.documentElement;

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
    };

    const resetRootInlineEffects = () => {
      const root = document.getElementById("root") as HTMLElement | null;
      if (!root) return;
      root.style.removeProperty("filter");
      root.style.removeProperty("backdrop-filter");
      root.style.removeProperty("transform");
      root.style.removeProperty("will-change");
    };

    const closeOverlaysViaEscape = () => {
      // Many overlays listen on window for Escape.
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    const removeStaleFullscreenBlurOverlays = () => {
      // Target only FULLSCREEN fixed nodes with backdrop-filter (blur), to avoid touching
      // small fixed UI like PWA prompts/toasts.
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const candidates = Array.from(document.querySelectorAll<HTMLElement>("body *"));
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.position !== "fixed") continue;

        const rect = el.getBoundingClientRect();
        const isFullscreen = rect.width >= vw - 2 && rect.height >= vh - 2;
        if (!isFullscreen) continue;

        const hasBackdropBlur = style.backdropFilter && style.backdropFilter !== "none";
        if (!hasBackdropBlur) continue;

        const z = Number.parseInt(style.zIndex || "0", 10);
        if (Number.isFinite(z) && z < 30) continue;

        // Remove only elements that are very likely overlays.
        // If React still owns this node, it will be re-rendered correctly.
        el.remove();
      }
    };

    try {
      closeOverlaysViaEscape();
      resetScrollLocks();
      resetRootInlineEffects();
      removeStaleFullscreenBlurOverlays();
    } catch {
      // Never block navigation due to cleanup.
    }
  }, [location.key]);

  return null;
}
