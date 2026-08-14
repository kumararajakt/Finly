import { useState } from "react";
import { Home, Loader2, LockKeyhole, LogIn, Mail, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { isValidEmail } from "@/lib/utils";

type AuthMode = "login" | "register";
type RegisterStep = "form" | "otp";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function AuthPage() {
  const { login, register, verifyOtp, resendOtp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";
  const isOtpStep = isRegister && registerStep === "otp";

  const emailValid = isValidEmail(email.trim());
  const passwordValid = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const formValid = isRegister
    ? emailValid && passwordValid && passwordsMatch
    : emailValid && password.length > 0;
  const otpValid = /^\d{6}$/.test(otp);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !formValid) return;
    setSaving(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !formValid) return;
    setSaving(true);
    setError(null);
    try {
      await register(email, password);
      setOtp("");
      setRegisterStep("otp");
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !otpValid) return;
    setSaving(true);
    setError(null);
    try {
      await verifyOtp(email, otp, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_IN_USE") {
        setError("An account already exists. Sign in instead.");
        setMode("login");
        setRegisterStep("form");
      } else if (err instanceof ApiError && (err.code === "OTP_EXPIRED" || err.code === "OTP_TOO_MANY_ATTEMPTS")) {
        setRegisterStep("form");
      }
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await resendOtp(email);
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setRegisterStep("form");
    setError(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
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
              {isOtpStep
                ? "Enter the 6-digit code sent to your email to finish creating your account."
                : isRegister
                  ? "Set your email and password to get started. This is a one-time setup."
                  : "Enter your email and password to continue."}
            </p>
          </div>
        </div>

        {isOtpStep ? (
          <form
            onSubmit={handleVerify}
            className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="space-y-1.5">
              <label htmlFor="auth-otp" className="text-sm font-medium">
                Verification code
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="pl-8"
                  maxLength={6}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={saving}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sent to {email}. The code expires in 10 minutes.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={saving || !otpValid}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Finish creating account
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setRegisterStep("form")}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Edit email or password
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={saving}
                className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                <RefreshCw className="mr-1 inline size-3.5" />
                Resend code
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={isRegister ? handleRegister : handleLogin}
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
              {isRegister && password.length > 0 && !passwordValid && (
                <p className="text-xs text-destructive">
                  Password must be at least 8 characters long.
                </p>
              )}
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <label htmlFor="auth-confirm-password" className="text-sm font-medium">
                  Confirm password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-8"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={saving}
                  />
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={saving || !formValid}>
              {saving ? <Loader2 className="animate-spin" /> : isRegister ? <UserPlus /> : <LogIn />}
              {isRegister ? "Continue" : "Sign in"}
            </Button>
          </form>
        )}

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
