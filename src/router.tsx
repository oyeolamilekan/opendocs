import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient, notifyManager } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'
import { routeTree } from './routeTree.gen'
import { RouteError } from './components/route-error'
import { RouteNotFound } from './components/route-not-found'

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const convexUrl = import.meta.env.VITE_CONVEX_URL

  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not configured')
  }

  const convexQueryClient = new ConvexQueryClient(convexUrl)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5 * 60_000,
      },
    },
  })

  convexQueryClient.connect(queryClient)

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      convexQueryClient,
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexProvider>
    ),
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
