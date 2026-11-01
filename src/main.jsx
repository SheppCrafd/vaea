import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
// Self-hosted (not Google Fonts' render-blocking <link>) so weight/timing
// can't drift between browser engines — see the cross-browser audit that
// found WebKit rendering headlines visibly lighter than Chrome/Edge/Firefox
// under the old <link>-based load.
import '@fontsource/space-grotesk/300.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/300.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import '@/index.css'
import { migrateLegacyStorageKeys } from '@/lib/migrateLegacyStorage'
import { clearRetiredConnectorsWhenReady } from '@/lib/retiredConnectors'

// Old addresses rewritten before anything renders, so the page doesn't draw
// one route and then swap to another (that measured a 0.63 layout shift).
// MarketingApp keeps <Navigate> routes for these as a fallback.
const LEGACY_PATHS = { '/assistant': '/vaea-chat', '/product': '/', '/self-hosting': '/privacy' }
const legacyTarget = LEGACY_PATHS[window.location.pathname.replace(/\/+$/, '')]
if (legacyTarget) window.history.replaceState(null, '', legacyTarget + window.location.search + window.location.hash)

migrateLegacyStorageKeys()
clearRetiredConnectorsWhenReady()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
