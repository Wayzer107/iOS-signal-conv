import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Minimal entry for the desktop app bootstrap
const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
