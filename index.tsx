import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

/**
 * Main application entry point.
 * Ensures the DOM is ready and the root element exists before mounting.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element. Check your index.html.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);