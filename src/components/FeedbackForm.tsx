import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Star, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FeedbackFormProps {
  language?: 'ar' | 'en';
}

const translations = {
  ar: {
    feedback: 'ملاحظات',
    sendFeedback: 'أرسل ملاحظاتك',
    feedbackType: 'نوع الملاحظة',
    general: 'عام',
    bug: 'خطأ تقني',
    feature: 'اقتراح ميزة',
    improvement: 'تحسين',
    message: 'رسالتك',
    messagePlaceholder: 'شاركنا رأيك أو اقتراحك...',
    rating: 'التقييم',
    submit: 'إرسال',
    submitting: 'جاري الإرسال...',
    successTitle: 'شكراً لك!',
    successMessage: 'تم استلام ملاحظاتك بنجاح',
    errorMessage: 'حدث خطأ. حاول مرة أخرى',
    loginRequired: 'يجب تسجيل الدخول أولاً',
  },
  en: {
    feedback: 'Feedback',
    sendFeedback: 'Send Feedback',
    feedbackType: 'Feedback Type',
    general: 'General',
    bug: 'Bug Report',
    feature: 'Feature Request',
    improvement: 'Improvement',
    message: 'Your Message',
    messagePlaceholder: 'Share your thoughts or suggestions...',
    rating: 'Rating',
    submit: 'Submit',
    submitting: 'Submitting...',
    successTitle: 'Thank you!',
    successMessage: 'Your feedback has been received',
    errorMessage: 'An error occurred. Please try again',
    loginRequired: 'Please sign in first',
  }
};

export function FeedbackForm({ language = 'en' }: FeedbackFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedbackType, setFeedbackType] = useState('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t.loginRequired);
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        email: user.email,
        feedback_type: feedbackType,
        message: message.trim(),
        rating: rating > 0 ? rating : null,
      });

      if (error) throw error;

      toast.success(t.successTitle, { description: t.successMessage });
      setMessage('');
      setRating(0);
      setFeedbackType('general');
      setOpen(false);
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error(t.errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors w-full"
        >
          <MessageSquare size={20} />
          <span>{t.feedback}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.sendFeedback}</DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? 'نقدر رأيك ونسعى دائماً للتحسين'
              : 'We value your input and strive to improve'
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t.feedbackType}</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{t.general}</SelectItem>
                <SelectItem value="bug">{t.bug}</SelectItem>
                <SelectItem value="feature">{t.feature}</SelectItem>
                <SelectItem value="improvement">{t.improvement}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.message}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePlaceholder}
              rows={4}
              required
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.rating}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-colors"
                >
                  <Star
                    size={24}
                    className={
                      star <= (hoveredRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground"
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !message.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.submitting}
              </>
            ) : (
              t.submit
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
