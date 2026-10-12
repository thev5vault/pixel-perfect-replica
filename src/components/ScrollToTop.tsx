import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll<HTMLElement>(".overflow-y-auto, main").forEach((container) => {
        container.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.searchStr, location.hash]);

  return null;
}
