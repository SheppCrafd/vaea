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
import HomePage from '@/pages/marketing/HomePage';
import FeaturesPage from '@/pages/marketing/FeaturesPage';
import HowItWorksPage from '@/pages/marketing/HowItWorksPage';
import LoginPage from '@/pages/marketing/LoginPage';
import SignUpPage from '@/pages/marketing/SignUpPage';
import AboutPage from '@/pages/marketing/AboutPage';
import PrivacyPage from '@/pages/marketing/PrivacyPage';
import TermsPage from '@/pages/marketing/TermsPage';
import ComparePage from '@/pages/marketing/ComparePage';
// Everything reachable only via /app/* — Dashboard, AppShell, the chat
// controller, the command palette, the device storage gate — is lazy too,
// same as /chat and /settings already were. Anonymous visitors landing on
// the marketing routes below (the overwhelming majority of first hits, per
// the SEO audit that flagged this) never download or parse any of that
// authenticated-app code; only navigating to /app/* fetches it. See
// AuthenticatedApp.jsx's own header for what moved there.
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));
// Add page imports here

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
                    {/* The public marketing site (/, /features, /how-it-works,
                        /compare, /about, /login, /signup) renders completely outside AuthenticatedApp —
                        real, unauthenticated, scrollable content, not just
                        past a lenient auth check. The actual product lives
                        under /app/*, gated by AuthenticatedApp as before. */}
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/features" element={<FeaturesPage />} />
                      <Route path="/how-it-works" element={<HowItWorksPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/compare" element={<ComparePage />} />
                      <Route path="/privacy" element={<PrivacyPage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
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
                      <Route path="*" element={<Navigate to="/" replace />} />
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
