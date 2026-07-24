import { lazy, Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginScreen from '@/components/auth/LoginScreen';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import { CardViewProvider } from '@/lib/CardViewContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import DeviceStorageGate from '@/components/shared/DeviceStorageGate';
import AppShell from '@/components/layout/AppShell';
import Header from '@/components/layout/Header';
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
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

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
      // Used to auto-redirect to Base44's hosted /login — but that page
      // route only serves a real login form for apps built through Base44's
      // own builder UI. Vaea is a custom Vite build (site deploy), so /login
      // just reloads this SPA, which immediately hits auth_required again —
      // a dead end (or, before the old loop-guard, an infinite bounce). See
      // Decisions/Vaea - Full-App Login Gate Restored.md. LoginScreen signs
      // in via real Base44 API routes instead, which don't have this problem.
      return <LoginScreen />;
    }
  }

  // Header now renders once here, above every route, instead of inside
  // AppShell — so it (and its Dashboard/Chat/Settings tab bar) is present
  // everywhere, not just on the dashboard. /chat and /settings still own
  // their own content below it (no sidebars/hamburgers, same as before) —
  // only the top bar itself is now shared. CommandPalette stays alongside
  // Routes rather than inside AppShell, for the same "works everywhere"
  // reason.
  return (
    <DeviceStorageGate>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 min-h-0">
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
        </div>
      </div>
    </DeviceStorageGate>
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
