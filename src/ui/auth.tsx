import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../data/supabaseClient";

// Auth state for the presentation layer: reflects the current Supabase session
// and drives edit-affordance gating (via useMutations().canWrite) plus the
// sign-in control. Writes themselves are enforced by RLS on the server.
interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  async signInWithGoogle() {},
  async signOut() {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Return to this app after Google auth. BASE_URL keeps the GitHub Pages
      // sub-path correct; the PKCE `?code=` is exchanged by detectSessionInUrl.
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
