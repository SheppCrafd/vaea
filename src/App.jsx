import { lazy, Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth, hasAttemptedAuthRedirect, markAuthRedirectAttempted } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import { CardViewProvider } from '@/lib/CardViewContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import AppShell from '@/components/layout/AppShell';
import Dashboard from '@/pages/Dashboard';
import CommandPalette from '@/components/command/CommandPalette';
// /chat and /settings are code-split out of the main bundle — they're
// reached only by an explicit click (never on first load), so there's no
// reason to make every visitor download and parse their code (react-markdown,
// the chat session UI, the appearance settings panel) up front. Dashboard —
// the route everyone hits first — stays a static import.
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const VaultSetupGuidePage = lazy(() => import('@/pages/VaultSetupGuidePage'));
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Auto-redirect to Base44's hosted login, but only once per tab
      // session (see hasAttemptedAuthRedirect's comment in AuthContext.jsx)
      // — a stale/invalid token that survives the login round-trip would
      // otherwise bounce forever between this app and Base44's login page.
      if (!hasAttemptedAuthRedirect()) {
        markAuthRedirectAttempted();
        navigateToLogin();
        return null;
      }
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
          <div className="max-w-sm text-center space-y-3">
            <p className="text-sm font-medium">Couldn't sign you in automatically</p>
            <p className="text-xs text-muted-foreground">
              Sign-in is required to use this app. If this keeps happening, try again in a moment.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => { markAuthRedirectAttempted(); navigateToLogin(); }}
                className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Render the main app. /chat and /settings are standalone full-page
  // experiences (their own layout) so they're deliberately NOT wrapped in
  // AppShell's three-column dashboard chrome — every other route is.
  // CommandPalette is mounted here, alongside the Routes rather than inside
  // AppShell, specifically so its Ctrl/Cmd+K shortcut also works from /chat
  // and /settings, not just the dashboard.
  return (
    <Suspense fallback={null}>
      <CommandPalette />
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/vault-setup" element={<VaultSetupGuidePage />} />
        {/* Add your page Route elements here */}
        <Route path="/" element={<AppShell><Dashboard /></AppShell>} />
        <Route path="*" element={<AppShell><PageNotFound /></AppShell>} />
      </Routes>
    </Suspense>
  );
};

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
                    <AuthenticatedApp />
                  </ErrorBoundary>
                </Router>
                <Toaster />
              </CardViewProvider>
            </FilterProvider>
          </HighlightProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
