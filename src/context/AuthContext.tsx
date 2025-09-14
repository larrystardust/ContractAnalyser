import React, { createContext, useContext, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from 'react-i18next'; // ADDED

interface AuthContextType {
  sendPasswordResetEmail: (email: string) => Promise<void>; // MODIFIED: Removed redirectTo parameter
  resetPassword: (newPassword: string) => Promise<void>;
}

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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // MODIFIED: Hardcoded the redirectTo URL
      });

      if (error) throw error;

      alert(t('password_reset_email_sent_alert')); // MODIFIED
    } catch (error: any) {
      console.error("Password reset email error:", error);
      alert(t('failed_to_send_password_reset_alert')); // MODIFIED
      throw error;
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