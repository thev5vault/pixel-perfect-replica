import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    document.querySelectorAll<HTMLElement>(".overflow-y-auto, main").forEach((container) => {
      container.scrollTop = 0;
    });
  }, [location.pathname, location.searchStr, location.hash]);

  return null;
}
