import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.ts'; // Import your Supabase client
import { AuthProvider } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx'; // ADDED: Import ToastProvider

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionContextProvider supabaseClient={supabase}>
        <AuthProvider>
          <ToastProvider> {/* ADDED: Wrap App with ToastProvider */}
            <App />
          </ToastProvider>
        </AuthProvider>
      </SessionContextProvider>
    </BrowserRouter>
  </StrictMode>
);