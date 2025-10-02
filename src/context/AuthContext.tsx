import React, { createContext, useContext, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from 'react-i18next'; // ADDED
import { useNavigate, useLocation, NavigateFunction } from "react-router-dom"; // ADDED

interface AuthContextType {
  sendPasswordResetEmail: (email: string) => Promise<void>; // MODIFIED: Removed redirectTo parameter
  resetPassword: (newPassword: string) => Promise<void>;
}

// Helper function to clear navigation history and force a hard reload
// This function is now primarily used as a fallback/final reset mechanism
const clearNavigationHistory = (navigate: NavigateFunction) => {
  // Replace the current entry with the landing page
  // This prevents going back to authenticated pages
  navigate("/", { replace: true });

  // Force a page reload to clear any in-memory state
  window.location.href = "/";
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation(); // ADDED

  const sendPasswordResetEmail = useCallback(async (email: string) => { // MODIFIED: Removed redirectTo parameter
    try {
      // CRITICAL FIX: Sign out globally before initiating password reset
      // This invalidates all other active sessions for the user.
      await supabase.auth.signOut({ scope: 'global' });
      // console.log('AuthContext: Signed out globally before sending password reset email.'); // REMOVED

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // MODIFIED: Hardcoded the redirectTo URL
      });

      if (error) throw error;

      alert(t('password_reset_email_sent_alert')); // MODIFIED
    } catch (error: any) {
      console.error("Password reset email error:", error);
      
      let userFacingMessage = t('failed_to_send_password_reset_alert'); // Default generic message

      // Check for the specific rate-limiting error message
      const cooldownMatch = error.message.match(/for security purposes, you can only request this after (\d+) seconds/i);
      if (cooldownMatch && cooldownMatch[1]) {
        const seconds = parseInt(cooldownMatch[1], 10);
        userFacingMessage = t('password_reset_cooldown_message', { seconds });
      } else if (error.message) {
        userFacingMessage = error.message; // Use Supabase's message if it's not the cooldown and not generic
      }

      // Now, throw the translated user-facing message
      throw new Error(userFacingMessage);
    }
  }, [t]); // MODIFIED: Added t to dependency array

  const resetPassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      alert(t('password_successfully_reset_alert')); // MODIFIED
    } catch (error: any) {
      console.error("Password reset error:", error);
      alert(t('failed_to_reset_password_alert')); // MODIFIED
      throw error;
    }
  }, [t]); // MODIFIED: Added t to dependency array

  const memoizedValue = React.useMemo(() => ({
    sendPasswordResetEmail,
    resetPassword,
  }), [
    sendPasswordResetEmail,
    resetPassword,
  ]);

  return (
    <AuthContext.Provider
      value={memoizedValue}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;