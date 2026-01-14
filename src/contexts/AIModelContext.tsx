import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AIModelPreferences, 
  DEFAULT_AI_PREFERENCES,
  AIFunction,
  getModelById,
  getAvailableModelsForFunction,
  AIModel
} from '@/types/aiModels';

interface AIModelContextType {
  preferences: AIModelPreferences;
  isLoading: boolean;
  updatePreferences: (updates: Partial<AIModelPreferences>) => Promise<void>;
  getModelForFunction: (fn: AIFunction) => AIModel | undefined;
  getAvailableModels: (fn: AIFunction) => AIModel[];
  setCurrentModel: (fn: AIFunction, modelId: string) => void;
  currentModels: Record<AIFunction, string | null>;
}

const AIModelContext = createContext<AIModelContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ai_model_preferences';

export function AIModelProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AIModelPreferences>(DEFAULT_AI_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Track currently selected model for each function (for manual mode)
  const [currentModels, setCurrentModels] = useState<Record<AIFunction, string | null>>({
    images: null,
    daily_chat: null,
    deep_analysis: null,
    deep_research: null,
  });

  // Load preferences from local storage or database
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Try to get user
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);

        // First try local storage
        const storedPrefs = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedPrefs) {
          try {
            const parsed = JSON.parse(storedPrefs);
            setPreferences({ ...DEFAULT_AI_PREFERENCES, ...parsed });
          } catch {
            // Invalid JSON, use defaults
          }
        }

        // If user is logged in, try to load from profile
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          // Check if profile has ai_preferences field (we'll store as JSON in existing profile)
          // For now, we use local storage as the source of truth since the DB schema
          // doesn't have ai_preferences column yet
        }

        // Initialize current models with defaults
        setCurrentModels({
          images: preferences.defaultModels.images,
          daily_chat: preferences.defaultModels.daily_chat,
          deep_analysis: preferences.defaultModels.deep_analysis,
          deep_research: preferences.defaultModels.deep_research,
        });
      } catch (error) {
        console.error('Error loading AI preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Update current models when preferences change
  useEffect(() => {
    setCurrentModels(prev => ({
      images: prev.images || preferences.defaultModels.images,
      daily_chat: prev.daily_chat || preferences.defaultModels.daily_chat,
      deep_analysis: prev.deep_analysis || preferences.defaultModels.deep_analysis,
      deep_research: prev.deep_research || preferences.defaultModels.deep_research,
    }));
  }, [preferences.defaultModels]);

  const updatePreferences = useCallback(async (updates: Partial<AIModelPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    
    // Save to local storage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newPreferences));
    
    // If we have a user, we could save to database here
    // For now, local storage is sufficient
  }, [preferences]);

  const getModelForFunction = useCallback((fn: AIFunction): AIModel | undefined => {
    if (preferences.modelSelectionMode === 'automatic') {
      // Use the default model for this function
      const modelId = preferences.defaultModels[fn];
      return getModelById(modelId);
    } else {
      // Use the currently selected model for this function
      const modelId = currentModels[fn] || preferences.defaultModels[fn];
      return getModelById(modelId);
    }
  }, [preferences, currentModels]);

  const getAvailableModels = useCallback((fn: AIFunction): AIModel[] => {
    return getAvailableModelsForFunction(fn, preferences.selectedModels);
  }, [preferences.selectedModels]);

  const setCurrentModel = useCallback((fn: AIFunction, modelId: string) => {
    setCurrentModels(prev => ({
      ...prev,
      [fn]: modelId,
    }));
  }, []);

  return (
    <AIModelContext.Provider
      value={{
        preferences,
        isLoading,
        updatePreferences,
        getModelForFunction,
        getAvailableModels,
        setCurrentModel,
        currentModels,
      }}
    >
      {children}
    </AIModelContext.Provider>
  );
}

export function useAIModel() {
  const context = useContext(AIModelContext);
  if (context === undefined) {
    throw new Error('useAIModel must be used within an AIModelProvider');
  }
  return context;
}

export { AIModelContext };
