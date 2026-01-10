import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, User, Building2, GraduationCap, Phone } from "lucide-react";
import studybudyLogo from "@/assets/studybudy-logo.png";

const CompleteProfile = () => {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [formData, setFormData] = useState({
    fullName: "",
    university: "",
    department: "",
    phoneNumber: "",
  });

  useEffect(() => {
    const checkProfileStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      // Check if profile is already complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed, full_name, university, department, phone_number")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.profile_completed) {
        navigate("/app/dashboard", { replace: true });
        return;
      }

      // Pre-fill any existing data
      if (profile) {
        setFormData({
          fullName: profile.full_name || "",
          university: profile.university || "",
          department: profile.department || "",
          phoneNumber: profile.phone_number || "",
        });
      }

      setCheckingProfile(false);
    };

    checkProfileStatus();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.fullName.trim()) {
      toast({ title: t("fullNameRequired"), variant: "destructive" });
      return;
    }
    if (!formData.university.trim()) {
      toast({ title: t("universityRequired"), variant: "destructive" });
      return;
    }
    if (!formData.department.trim()) {
      toast({ title: t("departmentRequired"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: session.user.id,
          email: session.user.email,
          full_name: formData.fullName.trim(),
          display_name: formData.fullName.trim(),
          university: formData.university.trim(),
          department: formData.department.trim(),
          phone_number: formData.phoneNumber.trim() || null,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({ title: t("profileUpdated") });
      navigate("/app/dashboard", { replace: true });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={dir}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16">
            <img src={studybudyLogo} alt="StudyBudy" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl">{t("completeYourProfile")}</CardTitle>
          <CardDescription>{t("profileRequiredInfo")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {t("fullName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder={t("fullName")}
                required
                disabled={loading}
              />
            </div>

            {/* University */}
            <div className="space-y-2">
              <Label htmlFor="university" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                {t("university")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="university"
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                placeholder={t("university")}
                required
                disabled={loading}
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {t("department")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder={t("department")}
                required
                disabled={loading}
              />
            </div>

            {/* Phone Number (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {t("phoneNumber")} <span className="text-muted-foreground text-xs">({t("optional")})</span>
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder={t("phoneNumber")}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t("saving")}
                </>
              ) : (
                t("saveAndContinue")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfile;
