import { lazy, Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import AppShell from '@/components/layout/AppShell';
import Dashboard from '@/pages/Dashboard';
// /chat and /settings are code-split out of the main bundle — they're
// reached only by an explicit click (never on first load), so there's no
// reason to make every visitor download and parse their code (react-markdown,
// the chat session UI, the appearance settings panel) up front. Dashboard —
// the route everyone hits first — stays a static import.
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
// Add page imports here

function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClientInstance}>
        <HighlightProvider>
          <FilterProvider>
            <Router>
              <ScrollToTop />
              {/* /chat and /settings are standalone full-page experiences
                  (their own layout) so they're deliberately NOT wrapped in
                  AppShell's three-column dashboard chrome — every other
                  route is. */}
              <Suspense fallback={null}>
                <Routes>
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  {/* Add your page Route elements here */}
                  <Route path="/" element={<AppShell><Dashboard /></AppShell>} />
                  <Route path="*" element={<AppShell><PageNotFound /></AppShell>} />
                </Routes>
              </Suspense>
            </Router>
            <Toaster />
          </FilterProvider>
        </HighlightProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
