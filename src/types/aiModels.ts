// AI Model Types and Configuration

export type AIProvider = 'openai' | 'google' | 'anthropic';

export type AIFunction = 'images' | 'daily_chat' | 'deep_analysis' | 'deep_research';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  capabilities: AIFunction[];
  apiIdentifier: string;
}

export interface AIModelPreferences {
  selectedModels: string[]; // Array of model IDs that user has selected to be available
  defaultModels: {
    images: string;
    daily_chat: string;
    deep_analysis: string;
    deep_research: string;
  };
  modelSelectionMode: 'automatic' | 'manual'; // automatic = system chooses based on function, manual = user chooses each time
}

// Available AI Models
export const AI_MODELS: AIModel[] = [
  // OpenAI Models
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    description: 'Latest GPT model for general-purpose tasks',
    capabilities: ['daily_chat', 'deep_analysis'],
    apiIdentifier: 'openai/gpt-5.2',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Lightweight GPT model for quick tasks',
    capabilities: ['daily_chat'],
    apiIdentifier: 'openai/gpt-5-nano',
  },
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    provider: 'openai',
    description: 'OpenAI image generation model',
    capabilities: ['images'],
    apiIdentifier: 'openai/gpt-image-1.5',
  },
  {
    id: 'sora-2-pro',
    name: 'Sora 2 Pro',
    provider: 'openai',
    description: 'Advanced video generation model',
    capabilities: ['images'],
    apiIdentifier: 'openai/sora-2-pro',
  },
  {
    id: 'o3-deep-research',
    name: 'o3 Deep Research',
    provider: 'openai',
    description: 'OpenAI deep research model',
    capabilities: ['deep_research', 'deep_analysis'],
    apiIdentifier: 'openai/o3-deep-research',
  },
  
  // Google Models
  {
    id: 'gemini-flash-3',
    name: 'Gemini Flash 3',
    provider: 'google',
    description: 'Fast Google Gemini model for quick responses',
    capabilities: ['daily_chat'],
    apiIdentifier: 'google/gemini-flash-3',
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    description: 'Advanced Gemini model for deep thinking',
    capabilities: ['daily_chat', 'deep_analysis'],
    apiIdentifier: 'google/gemini-3-pro',
  },
  {
    id: 'nanobanana-pro',
    name: 'NanoBanana Pro',
    provider: 'google',
    description: 'Google image generation model',
    capabilities: ['images'],
    apiIdentifier: 'google/nanobanana-pro',
  },
  {
    id: 'veo-2.1',
    name: 'Veo 2.1',
    provider: 'google',
    description: 'Google video generation model',
    capabilities: ['images'],
    apiIdentifier: 'google/veo-2.1',
  },
  {
    id: 'gemini-deep-research',
    name: 'Gemini Deep Research',
    provider: 'google',
    description: 'Best available Gemini deep research model',
    capabilities: ['deep_research', 'deep_analysis'],
    apiIdentifier: 'google/gemini-2.0-flash-thinking-exp',
  },
  
  // Anthropic Models
  {
    id: 'opus-4.5',
    name: 'Opus 4.5',
    provider: 'anthropic',
    description: 'Most capable Anthropic model',
    capabilities: ['daily_chat', 'deep_analysis', 'deep_research'],
    apiIdentifier: 'anthropic/claude-opus-4.5',
  },
  {
    id: 'sonnet-4.5',
    name: 'Sonnet 4.5',
    provider: 'anthropic',
    description: 'Balanced Anthropic model',
    capabilities: ['daily_chat', 'deep_analysis'],
    apiIdentifier: 'anthropic/claude-sonnet-4.5',
  },
  {
    id: 'haiku-4.5',
    name: 'Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast and efficient Anthropic model',
    capabilities: ['daily_chat'],
    apiIdentifier: 'anthropic/claude-haiku-4.5',
  },
  {
    id: 'anthropic-deep-research',
    name: 'Anthropic Deep Research',
    provider: 'anthropic',
    description: 'Best available Anthropic deep research model',
    capabilities: ['deep_research', 'deep_analysis'],
    apiIdentifier: 'anthropic/claude-opus-4.5',
  },
];

// Default model assignments per function
export const DEFAULT_MODELS: AIModelPreferences['defaultModels'] = {
  images: 'nanobanana-pro',           // NanoBanana Pro (Google)
  daily_chat: 'gpt-5.2',              // GPT-5.2 (OpenAI) - maps to ChatGPT
  deep_analysis: 'gemini-3-pro',      // Gemini 3 Pro (Google)
  deep_research: 'gemini-deep-research', // Gemini Deep Research (Google)
};

// Default selected models (all models available by default)
export const DEFAULT_SELECTED_MODELS: string[] = AI_MODELS.map(m => m.id);

// Default preferences
export const DEFAULT_AI_PREFERENCES: AIModelPreferences = {
  selectedModels: DEFAULT_SELECTED_MODELS,
  defaultModels: DEFAULT_MODELS,
  modelSelectionMode: 'automatic',
};

// Helper functions
export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === id);
}

export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter(m => m.provider === provider);
}

export function getModelsByCapability(capability: AIFunction): AIModel[] {
  return AI_MODELS.filter(m => m.capabilities.includes(capability));
}

export function getAvailableModelsForFunction(
  fn: AIFunction, 
  selectedModels: string[]
): AIModel[] {
  return AI_MODELS.filter(
    m => m.capabilities.includes(fn) && selectedModels.includes(m.id)
  );
}

export function getDefaultModelForFunction(
  fn: AIFunction,
  preferences: AIModelPreferences
): AIModel | undefined {
  const modelId = preferences.defaultModels[fn];
  return getModelById(modelId);
}

// Provider display info
export const PROVIDER_INFO: Record<AIProvider, { name: string; color: string }> = {
  openai: { name: 'OpenAI', color: 'bg-green-500' },
  google: { name: 'Google', color: 'bg-blue-500' },
  anthropic: { name: 'Anthropic', color: 'bg-orange-500' },
};

// Function display info
export const FUNCTION_INFO: Record<AIFunction, { name: string; description: string }> = {
  images: { name: 'Image Generation', description: 'Generate and analyze images' },
  daily_chat: { name: 'Daily Chat', description: 'General conversation and quick tasks' },
  deep_analysis: { name: 'Deep Analysis', description: 'Complex thinking and analysis' },
  deep_research: { name: 'Deep Research', description: 'In-depth research tasks' },
};
