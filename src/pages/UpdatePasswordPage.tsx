import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const RECOVERY_TOKENS_KEY = "RECOVERY_TOKENS";

const UpdatePasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Debug state
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const logUrlContext = (label: string) => {
    console.log(`[URL DEBUG] ${label}:`, window.location.href);
  };

  useEffect(() => {
    processAuthCallback();
    refreshDebugInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processAuthCallback = async () => {
    console.log("=== processAuthCallback START ===");
    logUrlContext("Initial page load");

    const hash = window.location.hash;

    if (hash && hash.includes("access_token")) {
      console.log("Found recovery tokens in URL hash:", hash);

      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      console.log("Parsed tokens:", {
        access_token: access_token ? access_token.substring(0, 6) + "..." : null,
        refresh_token: refresh_token ? refresh_token.substring(0, 6) + "..." : null,
      });

      if (access_token && refresh_token) {
        sessionStorage.setItem(
          RECOVERY_TOKENS_KEY,
          JSON.stringify({ access_token, refresh_token })
        );
      }

      try {
        console.log("Setting Supabase session with parsed tokens...");
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error("Error setting Supabase session:", error.message);
        } else {
          console.log("Supabase session successfully set.");
          logUrlContext("After supabase.auth.setSession");

          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log("Confirmed active session:", sessionData.session);

            // ✅ Now safe to clean tokens from URL
            window.history.replaceState(null, "", window.location.pathname + "#");
            logUrlContext("After cleaning URL");
          } else {
            console.warn("No active session after setSession!");
          }
        }
      } catch (err) {
        console.error("Exception while setting Supabase session:", err);
      }
    } else {
      console.log("No recovery tokens in URL hash. Checking sessionStorage...");

      const stored = sessionStorage.getItem(RECOVERY_TOKENS_KEY);
      if (stored) {
        console.log("Found stored tokens in sessionStorage");
        const { access_token, refresh_token } = JSON.parse(stored);

        try {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error(
              "Error restoring session from stored tokens:",
              error.message
            );
          } else {
            console.log("Session restored from sessionStorage.");
          }
        } catch (err) {
          console.error("Exception restoring session from storage:", err);
        }
      } else {
        console.log("No tokens available in sessionStorage.");
      }
    }

    console.log("=== processAuthCallback END ===");
  };

  const refreshDebugInfo = async () => {
    const stored = sessionStorage.getItem(RECOVERY_TOKENS_KEY);
    const tokens = stored ? JSON.parse(stored) : null;

    const { data: sessionData } = await supabase.auth.getSession();

    setDebugInfo({
      url: window.location.href,
      tokens: tokens
        ? {
            access_token: tokens.access_token.substring(0, 6) + "...",
            refresh_token: tokens.refresh_token.substring(0, 6) + "...",
          }
        : null,
      session: sessionData?.session || null,
    });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setErrorMsg("No active session found. Please request a new reset link.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccessMsg("Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
        logUrlContext("After navigate to /login");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
      refreshDebugInfo();
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-xl font-bold mb-4">Update Your Password</h1>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      {errorMsg && <p className="text-red-600 mt-4">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 mt-4">{successMsg}</p>}

      {/* Debug panel */}
      <div className="mt-6 p-4 border rounded bg-gray-50 text-xs">
        <h2 className="font-bold mb-2">Debug Info (Live)</h2>
        <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
        <button
          onClick={refreshDebugInfo}
          className="mt-2 px-2 py-1 bg-gray-200 rounded"
        >
          Refresh Debug Info
        </button>
      </div>
    </div>
  );
};

export default UpdatePasswordPage;