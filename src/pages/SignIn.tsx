import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ExternalLink, Lock, User } from "lucide-react";
import {
  isValidUsername,
  loginIdentifierToUsername,
  mapSignInError,
  showAuthSetupHelp,
  usernameToAuthEmail,
  usernameValidationMessage,
} from "@/lib/authUsername";
import { navigateAfterAuth } from "@/lib/navigateAfterAuth";

const SignIn = () => {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const authDomain = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim() ?? "";
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim() ?? "";
  const supabaseUsersUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/auth/users` : "https://supabase.com/dashboard";

  const handleSignIn = async () => {
    if (!isValidUsername(username)) {
      toast.error(usernameValidationMessage());
      return;
    }
    let email: string;
    try {
      email = usernameToAuthEmail(loginIdentifierToUsername(username));
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === "MISSING_AUTH_DOMAIN"
          ? showAuthSetupHelp()
            ? "Sign-in is not configured. Set VITE_AUTH_EMAIL_DOMAIN in your environment."
            : "Sign-in is not available right now."
          : "Invalid username or password.",
      );
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(mapSignInError(error), { duration: 8000 });
        return;
      }
      if (!data.session) {
        toast.error("Could not start your session. Try again or contact support.", { duration: 6000 });
        return;
      }
      toast.success("Signed in");
      await navigateAfterAuth(nav, data.session);
    } catch (e) {
      toast.error(mapSignInError(e), { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-20 max-w-md">
        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="mb-8">
            <span className="text-xs uppercase tracking-[0.3em] text-primary font-medium">HiSupply</span>
            <h1 className="font-display text-3xl font-bold mt-2">Sign in</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your username and password.</p>
          </div>

          {showAuthSetupHelp() && authDomain ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs text-muted-foreground space-y-2 mb-2">
              <p className="font-medium text-foreground">Do this in Supabase (once)</p>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>
                  Open{" "}
                  <a
                    href={supabaseUsersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-0.5 hover:underline"
                  >
                    Authentication → Users <ExternalLink className="h-3 w-3 inline" />
                  </a>
                  .
                </li>
                <li>
                  You must see a user whose email is exactly{" "}
                  <span className="font-mono text-foreground">admin@{authDomain}</span> (same domain as in your <span className="font-mono">.env</span>).
                </li>
                <li>
                  Click that user → menu (⋮) → <strong className="text-foreground">Confirm user</strong> if it says unconfirmed.
                </li>
                <li>
                  <strong className="text-foreground">Authentication → Providers → Email</strong> → turn <strong className="text-foreground">off</strong> “Confirm email”.
                </li>
              </ol>
            </div>
          ) : null}

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  placeholder="admin"
                  className="pl-10"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  placeholder="••••••••••"
                  className="pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleSignIn}
              disabled={!username || !password || busy}
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-cyan font-semibold mt-2"
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SignIn;
