import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { Dashboard } from "./index";

function VehiclePage() {
  const activeTab = useLocation().pathname;
  const mainContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.querySelector<HTMLElement>(".overflow-y-auto")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  return <div key={activeTab} ref={mainContainerRef} className="contents"><Dashboard /></div>;
}

export const Route = createFileRoute("/vehicle")({
  head: () => ({ meta: [{ title: "My Vehicle — V5Vault Passport" }, { name: "description", content: "Your vehicle health and service history at a glance." }] }),
  component: VehiclePage,
});
