import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage, LanguageToggle } from "@/contexts/LanguageContext";
import { Eye, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";
import { z } from "zod";


type AuthMode = "signIn" | "signUp" | "reset" | "updatePassword";

export default function Auth() {
  const navigate = useNavigate();
  const { t, dir, language } = useLanguage();

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [university, setUniversity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  const schemas = useMemo(() => {
    const emailSchema = z.string().trim().email().max(255);
    const passwordSchema = z.string().min(6).max(72);

    const signInSchema = z.object({
      email: emailSchema,
      password: passwordSchema,
    });

    const signUpSchema = z
      .object({
        fullName: z.string().trim().min(2, t("fullNameRequired")).max(100),
        email: emailSchema,
        password: passwordSchema,
        confirmPassword: z.string().min(6).max(72),
        department: z.string().trim().min(2, t("departmentRequired")).max(120),
        university: z.string().trim().min(2, t("universityRequired")).max(120),
        phoneNumber: z.string().trim().max(30).optional(),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: t("passwordsDoNotMatch"),
        path: ["confirmPassword"],
      });

    const resetSchema = z.object({
      email: emailSchema,
    });

    const updatePasswordSchema = z
      .object({
        password: passwordSchema,
        confirmPassword: z.string().min(6).max(72),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: t("passwordsDoNotMatch"),
        path: ["confirmPassword"],
      });

    return { signInSchema, signUpSchema, resetSchema, updatePasswordSchema };
  }, [t]);

  useEffect(() => {
    const detectRecovery = () => {
      const url = new URL(window.location.href);
      const hash = url.hash || "";
      return hash.includes("type=recovery") || url.searchParams.get("type") === "recovery";
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep callback synchronous
      const isRecovery = event === "PASSWORD_RECOVERY" || detectRecovery();

      if (isRecovery) {
        setMode("updatePassword");
        return;
      }

      if (session?.user) {
        navigate("/app/dashboard", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isRecovery = detectRecovery();
      if (isRecovery) {
        setMode("updatePassword");
        return;
      }
      if (session?.user) {
        navigate("/app/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const resetSensitiveFields = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    resetSensitiveFields();
  };

  const handleSignIn = async () => {
    const parsed = schemas.signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("error"));
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) throw error;
    navigate("/app/dashboard");
  };

  const handleSignUp = async () => {
    const parsed = schemas.signUpSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
      department,
      university,
      phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : undefined,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("error"));
      return;
    }

    const redirectUrl = `${window.location.origin}/app/dashboard`;

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: parsed.data.fullName,
          display_name: parsed.data.fullName,
          department: parsed.data.department,
          university: parsed.data.university,
          phone_number: parsed.data.phoneNumber ?? null,
        },
      },
    });

    if (error) throw error;
    toast.success(t("checkEmail"));
  };

  const handleSendReset = async () => {
    const parsed = schemas.resetSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("error"));
      return;
    }

    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
    if (error) throw error;

    toast.success(t("resetLinkSent"));
    switchMode("signIn");
  };

  const handleUpdatePassword = async () => {
    const parsed = schemas.updatePasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("error"));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw error;

    toast.success(t("passwordUpdated"));
    resetSensitiveFields();
    navigate("/app/dashboard", { replace: true });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // Redirect to complete-profile so Google users can fill required fields
      const redirectUrl = `${window.location.origin}/complete-profile`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("error");
      toast.error(message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signIn") await handleSignIn();
      else if (mode === "signUp") await handleSignUp();
      else if (mode === "reset") await handleSendReset();
      else if (mode === "updatePassword") await handleUpdatePassword();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("error");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signUp" ? t("createAccount") :
    mode === "reset" ? t("resetPassword") :
    mode === "updatePassword" ? t("setNewPassword") :
    t("welcomeBack");

  const subtitle =
    mode === "signUp" ? t("signUpDescription") :
    mode === "reset" ? t("resetPasswordDescription") :
    mode === "updatePassword" ? "" :
    t("signInDescription");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" dir={dir}>
      {/* Subtle Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Language toggle */}
      <div className="absolute top-6 end-6 z-20">
        <LanguageToggle />
      </div>

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-6 start-6 z-20 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowIcon className="w-4 h-4 flip-rtl rotate-180" />
        <span className="text-sm">{language === "ar" ? "الرئيسية" : "Home"}</span>
      </Link>

      <LiquidGlassCard variant="elevated" className="w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <span className="text-2xl font-bold text-foreground">StudyBudy</span>
          </Link>
          <h1 className="text-xl font-medium mb-2">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          {(mode === "signIn" || mode === "signUp" || mode === "reset") && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors"
                dir="ltr"
                autoComplete="email"
              />
            </div>
          )}

          {/* Signup fields */}
          {mode === "signUp" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm">{t("fullName")} <span className="text-destructive">*</span></Label>
                <Input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors"
                  dir="auto"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm">{t("department")} <span className="text-destructive">*</span></Label>
                <Input
                  id="department"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={t("departmentPlaceholder")}
                  className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors"
                  dir="auto"
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="university" className="text-sm">{t("university")} <span className="text-destructive">*</span></Label>
                <Input
                  id="university"
                  required
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder={t("universityPlaceholder")}
                  className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors"
                  dir="auto"
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm">{t("phoneNumber")} ({t("optional")})</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors"
                  dir="ltr"
                  autoComplete="tel"
                />
              </div>
            </>
          )}

          {/* Password (sign in / sign up) */}
          {(mode === "signIn" || mode === "signUp") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm">{t("password")}</Label>
                {mode === "signIn" && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => switchMode("reset")}
                  >
                    {t("forgotPassword")}
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors pe-11"
                  dir="ltr"
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password (sign up) */}
          {mode === "signUp" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">{t("confirmPassword")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors pe-11"
                  dir="ltr"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Update Password (recovery) */}
          {mode === "updatePassword" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm">{t("newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors pe-11"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword" className="text-sm">{t("confirmPassword")}</Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 bg-secondary/30 border-border/50 focus:border-primary transition-colors pe-11"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading
              ? (mode === "signUp"
                  ? t("signingUp")
                  : mode === "signIn"
                    ? t("signingIn")
                    : mode === "reset"
                      ? t("sending")
                      : t("updating"))
              : (mode === "signUp"
                  ? t("signUp")
                  : mode === "signIn"
                    ? t("signIn")
                    : mode === "reset"
                      ? t("sendResetLink")
                      : t("updatePassword"))}
          </Button>

          {mode === "reset" && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => switchMode("signIn")}> 
              {t("backToSignIn")}
            </Button>
          )}
        </form>

        {/* Google Sign In - Only show for signIn/signUp modes */}
        {(mode === "signIn" || mode === "signUp") && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-3"
              disabled={loading}
              onClick={handleGoogleSignIn}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('continueWithGoogle')}
            </Button>
          </>
        )}

        {/* Toggle sign in / sign up */}
        {(mode === "signIn" || mode === "signUp") && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => switchMode(mode === "signUp" ? "signIn" : "signUp")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "signUp" ? t("alreadyHaveAccount") : t("dontHaveAccount")}{" "}
              <span className="text-primary font-medium hover:underline">
                {mode === "signUp" ? t("signIn") : t("signUp")}
              </span>
            </button>
          </div>
        )}
      </LiquidGlassCard>
    </div>
  );
}
