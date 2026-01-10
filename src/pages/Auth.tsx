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
import studybudyLogo from "@/assets/studybudy-logo.png";

type AuthMode = "signIn" | "signUp" | "reset" | "updatePassword";

export default function Auth() {
  const navigate = useNavigate();
  const { t, dir, language } = useLanguage();

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
        email: emailSchema,
        password: passwordSchema,
        confirmPassword: z.string().min(6).max(72),
        department: z.string().trim().min(2).max(120),
        university: z.string().trim().min(2).max(120),
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
            <img src={studybudyLogo} alt="StudyBudy" className="h-14 mx-auto" />
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
                <Label htmlFor="department" className="text-sm">{t("department")}</Label>
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
                <Label htmlFor="university" className="text-sm">{t("university")}</Label>
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
