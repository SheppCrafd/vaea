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

migrateLegacyStorageKeys()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
