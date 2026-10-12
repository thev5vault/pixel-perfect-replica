import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Dashboard } from "./index";

function VehiclePage() {
  const activeTab = useLocation().pathname;
  const mainContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTop = 0;
      mainContainerRef.current.closest("main")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [activeTab]);

  return <div ref={mainContainerRef} className="contents"><Dashboard /></div>;
}

export const Route = createFileRoute("/vehicle")({
  head: () => ({ meta: [{ title: "My Vehicle — V5Vault Passport" }, { name: "description", content: "Your vehicle health and service history at a glance." }] }),
  component: VehiclePage,
});
