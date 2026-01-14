import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, Sparkles, Brain, Search, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAIModel } from '@/contexts/AIModelContext';
import { 
  AI_MODELS, 
  AIFunction, 
  FUNCTION_INFO, 
  PROVIDER_INFO,
  getModelsByCapability,
  AIProvider 
} from '@/types/aiModels';

interface AISettingsCardProps {
  language: 'en' | 'ar';
}

const translations = {
  en: {
    aiSettings: 'AI Settings',
    aiSettingsDesc: 'Configure AI model preferences for different tasks',
    modelSelectionMode: 'Model Selection Mode',
    automatic: 'Automatic',
    manual: 'Manual',
    automaticDesc: 'System automatically selects the best model for each task',
    manualDesc: 'Choose which model to use each time',
    defaultModels: 'Default Models',
    defaultModelsDesc: 'Set default model for each function type',
    availableModels: 'Available Models',
    availableModelsDesc: 'Select which models should be available in the app',
    images: 'Image Generation',
    dailyChat: 'Daily Chat',
    deepAnalysis: 'Deep Analysis',
    deepThinking: 'Deep Thinking',
    deepResearch: 'Deep Research',
    saveSettings: 'Save Settings',
    settingsSaved: 'AI settings saved successfully',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
  },
  ar: {
    aiSettings: 'إعدادات الذكاء الاصطناعي',
    aiSettingsDesc: 'تخصيص تفضيلات نماذج الذكاء الاصطناعي للمهام المختلفة',
    modelSelectionMode: 'وضع اختيار النموذج',
    automatic: 'تلقائي',
    manual: 'يدوي',
    automaticDesc: 'يختار النظام تلقائياً أفضل نموذج لكل مهمة',
    manualDesc: 'اختر النموذج المستخدم في كل مرة',
    defaultModels: 'النماذج الافتراضية',
    defaultModelsDesc: 'تعيين النموذج الافتراضي لكل نوع من المهام',
    availableModels: 'النماذج المتاحة',
    availableModelsDesc: 'حدد النماذج التي يجب أن تكون متاحة في التطبيق',
    images: 'توليد الصور',
    dailyChat: 'الدردشة اليومية',
    deepAnalysis: 'التحليل العميق',
    deepThinking: 'التفكير العميق',
    deepResearch: 'البحث العميق',
    saveSettings: 'حفظ الإعدادات',
    settingsSaved: 'تم حفظ إعدادات الذكاء الاصطناعي بنجاح',
    selectAll: 'تحديد الكل',
    deselectAll: 'إلغاء تحديد الكل',
  },
};

const functionIcons: Record<AIFunction, React.ReactNode> = {
  images: <Image className="w-4 h-4" />,
  daily_chat: <Bot className="w-4 h-4" />,
  deep_analysis: <Brain className="w-4 h-4" />,
  deep_research: <Search className="w-4 h-4" />,
};

export default function AISettingsCard({ language }: AISettingsCardProps) {
  const { toast } = useToast();
  const { preferences, updatePreferences, isLoading } = useAIModel();
  const [saving, setSaving] = useState(false);
  
  const t = translations[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const handleModeChange = async (checked: boolean) => {
    await updatePreferences({
      modelSelectionMode: checked ? 'manual' : 'automatic',
    });
  };

  const handleDefaultModelChange = async (fn: AIFunction, modelId: string) => {
    await updatePreferences({
      defaultModels: {
        ...preferences.defaultModels,
        [fn]: modelId,
      },
    });
  };

  const handleModelToggle = async (modelId: string, checked: boolean) => {
    const newSelectedModels = checked
      ? [...preferences.selectedModels, modelId]
      : preferences.selectedModels.filter(id => id !== modelId);
    
    await updatePreferences({ selectedModels: newSelectedModels });
  };

  const handleSelectAll = async () => {
    await updatePreferences({ selectedModels: AI_MODELS.map(m => m.id) });
  };

  const handleDeselectAll = async () => {
    // Keep at least the default models selected
    const defaultIds = Object.values(preferences.defaultModels);
    await updatePreferences({ selectedModels: defaultIds });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Preferences are already saved via updatePreferences
      toast({
        title: t.settingsSaved,
      });
    } finally {
      setSaving(false);
    }
  };

  const getProviderBadgeColor = (provider: AIProvider): string => {
    switch (provider) {
      case 'openai':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'google':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'anthropic':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const functionKeys: AIFunction[] = ['images', 'daily_chat', 'deep_analysis', 'deep_research'];
  const functionLabels: Record<AIFunction, string> = {
    images: t.images,
    daily_chat: t.dailyChat,
    deep_analysis: t.deepAnalysis,
    deep_research: t.deepResearch,
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Model Selection Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t.modelSelectionMode}
          </CardTitle>
          <CardDescription>
            {preferences.modelSelectionMode === 'automatic' ? t.automaticDesc : t.manualDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t.automatic}</Label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t.automatic}</span>
              <Switch
                checked={preferences.modelSelectionMode === 'manual'}
                onCheckedChange={handleModeChange}
              />
              <span className="text-sm text-muted-foreground">{t.manual}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Models */}
      <Card>
        <CardHeader>
          <CardTitle>{t.defaultModels}</CardTitle>
          <CardDescription>{t.defaultModelsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {functionKeys.map((fn) => {
            const availableModels = getModelsByCapability(fn).filter(m => 
              preferences.selectedModels.includes(m.id)
            );
            
            return (
              <div key={fn} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-[140px]">
                  {functionIcons[fn]}
                  <Label>{functionLabels[fn]}</Label>
                </div>
                <Select
                  value={preferences.defaultModels[fn]}
                  onValueChange={(value) => handleDefaultModelChange(fn, value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          <Badge variant="outline" className={`text-xs ${getProviderBadgeColor(model.provider)}`}>
                            {PROVIDER_INFO[model.provider].name}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Available Models */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.availableModels}</CardTitle>
              <CardDescription>{t.availableModelsDesc}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {t.selectAll}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                {t.deselectAll}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {(['openai', 'google', 'anthropic'] as AIProvider[]).map((provider) => (
              <div key={provider} className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${PROVIDER_INFO[provider].color}`} />
                  {PROVIDER_INFO[provider].name}
                </h4>
                <div className="grid gap-2 ms-4">
                  {AI_MODELS.filter(m => m.provider === provider).map((model) => {
                    const isDefault = Object.values(preferences.defaultModels).includes(model.id);
                    const isChecked = preferences.selectedModels.includes(model.id);
                    
                    return (
                      <div key={model.id} className="flex items-center space-x-3 rtl:space-x-reverse">
                        <Checkbox
                          id={model.id}
                          checked={isChecked}
                          disabled={isDefault && isChecked} // Can't uncheck if it's a default
                          onCheckedChange={(checked) => handleModelToggle(model.id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={model.id}
                            className="text-sm font-medium cursor-pointer flex items-center gap-2"
                          >
                            {model.name}
                            {isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </label>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                        <div className="flex gap-1">
                          {model.capabilities.map((cap) => (
                            <span key={cap} className="text-muted-foreground">
                              {functionIcons[cap]}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
        {t.saveSettings}
      </Button>
    </div>
  );
}
