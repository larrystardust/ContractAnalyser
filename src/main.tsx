import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.ts'; // Import your Supabase client
import { AuthProvider } from './context/AuthContext.tsx'; // ADDED: Import AuthProvider

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionContextProvider supabaseClient={supabase}>
        <AuthProvider> {/* ADDED: Wrap App with AuthProvider */}
          <App />
        </AuthProvider> {/* ADDED: Close AuthProvider */}
      </SessionContextProvider>
    </BrowserRouter>
  </StrictMode>
);