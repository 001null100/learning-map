import React from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './v25.css';
import App from './App.jsx';
import { AppearanceProvider } from './appearance/AppearanceProvider.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </React.StrictMode>,
);
