import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import {
  authEmailConfirmHelpMessage,
  isValidUsername,
  loginIdentifierToUsername,
  mapSignUpError,
  minPasswordLength,
  showAuthSetupHelp,
  usernameToAuthEmail,
  usernameValidationMessage,
} from "@/lib/authUsername";
import { navigateAfterAuth } from "@/lib/navigateAfterAuth";

const SignUp = () => {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const minLen = minPasswordLength();

  const handleSignUp = async () => {
    if (!isValidUsername(username)) {
      toast.error(usernameValidationMessage());
      return;
    }
    if (password.length < minLen) {
      toast.error(`Password must be at least ${minLen} characters.`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    let email: string;
    try {
      email = usernameToAuthEmail(loginIdentifierToUsername(username));
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === "MISSING_AUTH_DOMAIN"
          ? showAuthSetupHelp()
            ? "Sign-up is not configured. Set VITE_AUTH_EMAIL_DOMAIN in your environment."
            : "Sign-up is not available right now."
          : e instanceof Error && e.message === "INVALID_USERNAME"
            ? usernameValidationMessage()
            : "Unable to complete sign up.",
      );
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        toast.error(mapSignUpError(error));
        return;
      }
      if (data.session) {
        toast.success("Account created");
        await navigateAfterAuth(nav, data.session);
      } else {
        toast.warning(authEmailConfirmHelpMessage(), { duration: 8000 });
        nav("/signin", { replace: true });
      }
    } catch (e) {
      toast.error(mapSignUpError(e));
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
            <h1 className="font-display text-3xl font-bold mt-2">Sign up</h1>
            <p className="text-muted-foreground text-sm mt-1">Choose a username and password. No email field.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                  placeholder="my_username"
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
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                  placeholder="••••••••••"
                  className="pl-10 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">At least {minLen} characters. Use a strong, unique password.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                  placeholder="••••••••••"
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button
              onClick={handleSignUp}
              disabled={!username || !password || !confirm || busy}
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-cyan font-semibold mt-2"
            >
              {busy ? "Creating account…" : "Sign up"}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/signin" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SignUp;
