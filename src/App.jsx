import { lazy, Suspense, useEffect } from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { useAccentTheme } from '@/hooks/useAccentTheme';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import { CardViewProvider } from '@/lib/CardViewContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import DeviceStorageGate from '@/components/shared/DeviceStorageGate';
import { ChatControllerProvider } from '@/lib/ChatControllerContext';
import AppShell from '@/components/layout/AppShell';
import Header from '@/components/layout/Header';
import Dashboard from '@/pages/Dashboard';
import CommandPalette from '@/components/command/CommandPalette';
import HomePage from '@/pages/marketing/HomePage';
import FeaturesPage from '@/pages/marketing/FeaturesPage';
import HowItWorksPage from '@/pages/marketing/HowItWorksPage';
import LoginPage from '@/pages/marketing/LoginPage';
import SignUpPage from '@/pages/marketing/SignUpPage';
// /chat and /settings are code-split out of the main bundle — they're
// reached only by an explicit click (never on first load), so there's no
// reason to make every visitor download and parse their code (react-markdown,
// the chat session UI, the appearance settings panel) up front. Dashboard —
// the route everyone hits first — stays a static import.
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const VaultSetupGuidePage = lazy(() => import('@/pages/VaultSetupGuidePage'));
const BackdoorModeSetupGuidePage = lazy(() => import('@/pages/BackdoorModeSetupGuidePage'));
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();

  // The public marketing pages are normal scrollable documents; this app
  // shell (everything under /app) is a fixed, non-scrolling frame instead
  // (see index.css's html.app-shell-locked rule). Toggling the class here,
  // scoped to however long this component stays mounted, keeps that lock
  // from leaking onto /, /features, /how-it-works, /login — which never
  // mount this component at all (see the route split in App() below).
  useEffect(() => {
    document.documentElement.classList.add('app-shell-locked');
    return () => document.documentElement.classList.remove('app-shell-locked');
  }, []);

  // Applies the saved accent color to <html> on every real app load, not
  // just when AppearanceSection happens to mount — previously this hook was
  // only ever called from inside that Settings section, so a saved non-default
  // accent silently stayed unapplied (looking exactly like the "slate"
  // default) until the user actually opened Settings once per session and
  // its effect ran for the first time. Theme mode (light/dark) never had
  // this problem since ThemeProvider already wraps the whole app above.
  // AppearanceSection still calls the same hook itself for its own picker
  // UI/live preview; both instances read the same localStorage key.
  useAccentTheme();

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
      // Redirect to the real /login page (marketing site) rather than
      // rendering the login form in place — LoginScreen used to render
      // inline here since this used to be the only place unauthenticated
      // visitors ever landed. Now that / is public marketing content,
      // /login is a real, linkable route of its own; `from` carries the
      // originally-requested path so a deep link (e.g. /app/settings)
      // still lands where it was headed after signing in. See
      // Decisions/Vaea - Full-App Login Gate Restored.md for why a
      // redirect-based flow (not Base44's hosted /login) is used at all.
      const from = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/login?from=${from}`} replace />;
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
      {/* One real chat controller, created here — above every route — so
          navigating between Dashboard (the floating ChatBox widget) and
          /chat (the full-page ChatPage) never orphans an in-flight
          generation. See ChatControllerContext.jsx's own header for why
          each route calling useChatController itself was the actual bug
          behind live replies/typing appearing to "stop" on navigation. */}
      <ChatControllerProvider>
        <div className="h-screen flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 min-h-0">
            <Suspense fallback={null}>
              <CommandPalette />
              <Routes>
                <Route path="chat" element={<ChatPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/vault-setup" element={<VaultSetupGuidePage />} />
                <Route path="settings/backdoor-setup" element={<BackdoorModeSetupGuidePage />} />
                {/* Add your page Route elements here */}
                <Route index element={<AppShell><Dashboard /></AppShell>} />
                <Route path="*" element={<AppShell><PageNotFound /></AppShell>} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </ChatControllerProvider>
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
                    {/* The public marketing site (/, /features, /how-it-works,
                        /login, /signup) renders completely outside AuthenticatedApp —
                        real, unauthenticated, scrollable content, not just
                        past a lenient auth check. The actual product lives
                        under /app/*, gated by AuthenticatedApp as before. */}
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/features" element={<FeaturesPage />} />
                      <Route path="/how-it-works" element={<HowItWorksPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/app/*" element={<AuthenticatedApp />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </ErrorBoundary>
                </Router>
                <Toaster />
                <ConfirmDialog />
              </CardViewProvider>
            </FilterProvider>
          </HighlightProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
