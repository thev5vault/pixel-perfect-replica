import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // This app resets its shared scroll container on every navigation. Router
    // restoration would otherwise restore the previous tab's scroll position.
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
