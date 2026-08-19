import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

// Set by LoginScreen's "Continue without signing in" link — an explicit,
// remembered opt-out of the whole-app login gate below (see AGENTS.md).
// Chat is the one feature that still needs a real session for every
// provider except Local Mode (ChatSession/ChatMessage are Base44-hosted,
// RLS-gated, elsewhere; Local Mode keeps its own history entirely local —
// see useChatSessions.js/useChatMessages.js); everything else already works
// fully signed-out, so this just lets checkAppState skip past the
// auth_required branch instead of bouncing every visit back to /login.
const GUEST_MODE_KEY = 'vaea_guest_mode';

function readGuestMode() {
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(readGuestMode);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else if (readGuestMode()) {
          // Explicit opt-out (LoginScreen's "Continue without signing in"),
          // remembered across visits — skip the auth_required branch below
          // so AuthenticatedApp renders the app instead of bouncing back to
          // /login. Chat itself still enforces real auth on its own (Base44
          // RLS on ChatSession/ChatMessage + useChatController's existing
          // 401/403 -> ChatAuthPrompt handling) — this only affects whether
          // a guest can reach the dashboard at all.
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        } else {
          // No token at all (a fresh, never-logged-in visitor) used to fall
          // through here as "not authenticated, no error" — since
          // AuthenticatedApp in App.jsx only ever branches on authError,
          // not isAuthenticated, that silently let anonymous visitors reach
          // the full dashboard. Per AGENTS.md, login is required for the
          // whole app by default (restored from pre-fork history at the
          // user's explicit request) unless they've explicitly opted out
          // above — so this is the same auth_required path a stale token
          // takes, letting App.jsx's LoginScreen handle it.
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
          setAuthError({
            type: 'auth_required',
            message: 'Authentication required'
          });
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        // Log only message/status, never the full error object — Base44Error
        // keeps the raw axios error (including the Authorization header) as
        // an accessible `originalError` property, which console.error would
        // otherwise print in full to DevTools.
        console.error('App state check failed:', appError.message, appError.status);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error.message, error.status);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error.message, error.status);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      // Same target Zmanim Today's Settings.jsx uses (base44.auth.logout("/"))
      // — land back on the app root logged out, not wherever the click
      // happened to be (settings/chat/etc).
      base44.auth.logout("/");
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  // redirectToLogin() targets Base44's hosted /login page route, which only
  // serves a real login form for apps built through Base44's own builder —
  // Vaea is a custom Vite build (site deploy), so that route just reloads
  // this SPA instead of showing a login form (see LoginScreen.jsx for the
  // full writeup). loginWithProvider() hits a real API route instead, which
  // works regardless of hosting. This is the one-click fallback used outside
  // the main LoginScreen (e.g. the mid-chat sign-in prompt) — LoginScreen
  // itself calls base44.auth.loginWithProvider/loginViaEmailPassword
  // directly so it can offer the full provider/email picker.
  const navigateToLogin = () => {
    base44.auth.loginWithProvider('google', window.location.pathname + window.location.search);
  };

  // LoginScreen's "Continue without signing in" — remembers the choice so
  // the gate stays skipped on future visits, and clears any pending
  // auth_required error immediately so AuthenticatedApp stops redirecting
  // without needing a full reload.
  const continueAsGuest = () => {
    try {
      localStorage.setItem(GUEST_MODE_KEY, 'true');
    } catch {
      // best-effort — the choice just won't survive a reload, they'd see
      // the login gate again next visit
    }
    setIsGuest(true);
    setAuthError(null);
    setAuthChecked(true);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isGuest,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      continueAsGuest,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
