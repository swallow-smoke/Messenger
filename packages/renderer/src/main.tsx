import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster, useToasterStore, toast } from 'react-hot-toast';
import { App } from './app';
import './index.css';

const MAX_TOASTS = 3;

function ToastLimiter(): null {
  const { toasts } = useToasterStore();
  useEffect(() => {
    const visible = toasts.filter((t) => t.visible);
    if (visible.length > MAX_TOASTS) {
      toast.dismiss(visible[0].id);
    }
  }, [toasts]);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ToastLimiter />
    <Toaster
      position="bottom-right"
      gutter={8}
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
