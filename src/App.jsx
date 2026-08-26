import { lazy, Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import ChatAppearanceBridge from "@/components/shared/ChatAppearanceBridge"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import { CardViewProvider } from '@/lib/CardViewContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import LoginScreen from '@/components/auth/LoginScreen';
import SignUpScreen from '@/components/auth/SignUpScreen';

// The public marketing site was removed — Vaea is now app-only. `/` redirects
// straight into the product at `/app`. `/login` and `/signup` remain as the
// unauthenticated auth entry points (AuthContext redirects here on
// `auth_required`); they render the real auth screens directly, no marketing
// chrome. Everything else lives under `/app/*`, code-split behind this lazy
// import so the auth screens don't pull the whole app bundle.
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
                      <Route path="/" element={<Navigate to="/app" replace />} />
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
                      <Route path="*" element={<Navigate to="/app" replace />} />
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
