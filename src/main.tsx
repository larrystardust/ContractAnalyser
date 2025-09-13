import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.ts';
import { AuthProvider } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { HelmetProvider } from 'react-helmet-async'; // ADDED: Import HelmetProvider

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionContextProvider supabaseClient={supabase}>
        <AuthProvider>
          <ToastProvider>
            <HelmetProvider> {/* ADDED: Wrap App with HelmetProvider */}
              <App />
            </HelmetProvider>
          </ToastProvider>
        </AuthProvider>
      </SessionContextProvider>
    </BrowserRouter>
  </StrictMode>
);