import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "../auth";

// Sidebar sign-in / sign-out control. Rendered only in Supabase mode
// (see Sidebar). Being signed in is what unlocks edit affordances.
export function AuthControl() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  if (user) {
    return (
      <div className="auth">
        <span className="auth__user" title={user.email}>
          {user.email}
        </span>
        <button type="button" className="auth__btn" onClick={() => void signOut()}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    );
  }

  const signIn = async () => {
    setError(undefined);
    setBusy(true);
    try {
      // Redirects to Google, then back to the app — no further UI needed here.
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <button type="button" className="auth__btn" onClick={() => void signIn()} disabled={busy}>
        <LogIn size={14} /> {busy ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error && <p className="auth__error">{error}</p>}
    </div>
  );
}
