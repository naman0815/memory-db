import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Safety net for errors that bypass a local try/catch entirely — e.g. a
// Web Worker (tesseract.js, transformers.js's threaded WASM backend)
// throwing outside the promise it's nominally attached to. Confirmed this
// class of error is real: a tesseract worker error surfaced as an
// uncaught process-level exception in Node, not a rejected promise, which
// would have skipped a local .catch() entirely. This won't help with a
// genuine OS-level OOM kill (nothing JS-level can catch that), but it
// stops any other stray worker/promise error from taking down the whole
// app silently.
window.addEventListener('error', (e) => console.error('[unhandled error]', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => console.error('[unhandled rejection]', e.reason))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
