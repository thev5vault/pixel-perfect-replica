import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/passport/$vrm")({ component: PublicPassportAlias });

function PublicPassportAlias() {
  const { vrm } = Route.useParams();
  if (typeof window !== "undefined" && /\/full\/?$/.test(window.location.pathname)) return <Outlet />;
  return <Navigate to="/v/$vrm" params={{ vrm }} search={{ sample: false }} replace />;
}
