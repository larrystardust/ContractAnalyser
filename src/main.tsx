import { StrictMode, Suspense } from 'react'; // MODIFIED: Import Suspense
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.ts';
import { AuthProvider } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { HelmetProvider } from 'react-helmet-async';
import './i18n'; // ADDED: Import i18n configuration
import { I18nextProvider } from 'react-i18next'; // ADDED: Import I18nextProvider
import i18n from './i18n'; // ADDED: Import i18n instance

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionContextProvider supabaseClient={supabase}>
        <AuthProvider>
          <ToastProvider>
            <HelmetProvider>
              {/* ADDED: Wrap App with I18nextProvider and Suspense */}
              <I18nextProvider i18n={i18n}>
                <Suspense fallback={<div>Loading translations...</div>}> {/* ADDED: Suspense fallback */}
                  <App />
                </Suspense>
              </I18nextProvider>
            </HelmetProvider>
          </ToastProvider>
        </AuthProvider>
      </SessionContextProvider>
    </BrowserRouter>
  </StrictMode>
);