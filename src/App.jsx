import { lazy, Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import ChatAppearanceBridge from "@/components/shared/ChatAppearanceBridge"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import { CardViewProvider } from '@/lib/CardViewContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import LoginScreen from '@/components/auth/LoginScreen';
import SignUpScreen from '@/components/auth/SignUpScreen';
import MarketingApp from '@/marketing/MarketingApp';

// Route split:
//  - `/login`, `/signup` — the real auth screens, no marketing chrome
//    (AuthContext redirects here on `auth_required`).
//  - `/app/*` — the authenticated product, code-split behind this lazy
//    import so neither the marketing site nor the auth screens pull the
//    whole app bundle.
//  - everything else — the public marketing site (`src/marketing/`), which
//    owns its own nested <Routes>, layout, and 404. Its routes are
//    prerendered to static HTML at build time (scripts/prerender.mjs), so
//    first paint is real content, not a blank #root.
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <HighlightProvider>
            <FilterProvider>
              <CardViewProvider>
                <Router>
                  <ScrollToTop />
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/login" element={<LoginScreen />} />
                      <Route path="/signup" element={<SignUpScreen />} />
                      <Route
                        path="/app/*"
                        element={
                          <Suspense
                            fallback={
                              <div className="fixed inset-0 flex items-center justify-center bg-background">
                                <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin"></div>
                              </div>
                            }
                          >
                            <AuthenticatedApp />
                          </Suspense>
                        }
                      />
                      <Route path="*" element={<MarketingApp />} />
                    </Routes>
                  </ErrorBoundary>
                </Router>
                <Toaster />
                <ConfirmDialog />
                <ChatAppearanceBridge />
              </CardViewProvider>
            </FilterProvider>
          </HighlightProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
