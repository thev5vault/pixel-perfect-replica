import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/workshop")({
  component: () => <Navigate to="/garage" replace />,
});
