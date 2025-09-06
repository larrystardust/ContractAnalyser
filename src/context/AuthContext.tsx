import React, { createContext, useContext, useCallback } from "react";
import { supabase } from "../lib/supabase";

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
  const sendPasswordResetEmail = useCallback(async (email: string) => { // MODIFIED: Removed redirectTo parameter
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // MODIFIED: Hardcoded the redirectTo URL
      });

      if (error) throw error;

      alert("Password reset instructions sent to your email!");
    } catch (error: any) {
      console.error("Password reset email error:", error);
      alert("Failed to send password reset email");
      throw error;
    }
  }, []);

  const resetPassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      alert("Password successfully reset!");
    } catch (error: any) {
      console.error("Password reset error:", error);
      alert("Failed to reset password");
      throw error;
    }
  }, []);

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