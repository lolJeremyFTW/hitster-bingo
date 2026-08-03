import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureLoopbackOrigin } from './utils/spotifyAuth'

// Spotify weigert "localhost" als redirect URI — alleen de expliciete loopback
// 127.0.0.1 mag. Draaien we toch op localhost, dan sturen we door vóór React
// mount, zodat OAuth-tokens meteen op de juiste origin belanden.
if (!ensureLoopbackOrigin()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
