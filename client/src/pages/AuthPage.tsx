import { useState } from "react";
import { Home, Loader2, LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { isValidEmail } from "@/lib/utils";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";
  const emailValid = isValidEmail(email.trim());
  const formValid = emailValid && password.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !formValid) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_REGISTERED") {
        setError("An account already exists. Sign in instead.");
        setMode("login");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setEmail("");
    setPassword("");
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex aspect-square size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Home className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Finly</h1>
            <p className="text-sm text-muted-foreground">
              {isRegister
                ? "Set your email and password to get started. This is a one-time setup."
                : "Enter your email and password to continue."}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="pl-8"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={saving}
                autoFocus
              />
            </div>
            {email.length > 0 && !emailValid && (
              <p className="text-xs text-destructive">Enter a valid email address.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder="••••••••"
                className="pl-8"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={saving || !formValid}>
            {saving ? <Loader2 className="animate-spin" /> : isRegister ? <UserPlus /> : <LogIn />}
            {isRegister ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isRegister ? (
            <>
              Already set up?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Finly?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Create an account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
