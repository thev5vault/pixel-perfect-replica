import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "./index";

export const Route = createFileRoute("/vehicle")({
  head: () => ({ meta: [{ title: "My Vehicle — V5Vault Passport" }, { name: "description", content: "Your vehicle health and service history at a glance." }] }),
  component: Dashboard,
});
