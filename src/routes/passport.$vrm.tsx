import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/passport/$vrm")({ component: PublicPassportAlias });

function PublicPassportAlias() {
  const { vrm } = Route.useParams();
  return <Navigate to="/v/$vrm" params={{ vrm }} search={{ sample: false }} replace />;
}
