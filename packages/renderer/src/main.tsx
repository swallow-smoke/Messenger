import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { App } from './app';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#2d3039',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: '13px',
        },
        error: {
          style: {
            background: '#3d1f1f',
            border: '1px solid rgba(239,68,68,0.4)',
          },
        },
        success: {
          style: {
            background: '#1f3d2a',
            border: '1px solid rgba(34,197,94,0.4)',
          },
        },
      }}
    />
  </React.StrictMode>
);
