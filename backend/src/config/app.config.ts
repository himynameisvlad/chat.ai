import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  server: {
    port: number;
  };
  ai: {
    provider: 'deepseek' | 'openai' | 'claude' | 'huggingface';
    deepseek: {
      apiKey: string;
      baseURL: string;
      model: string;
    };
    claude: {
      apiKey: string;
      model: string;
      maxTokens: number;
    };
    huggingface: {
      apiKey: string;
      model: string;
    };
  };
}

const getConfig = (): AppConfig => {
  const config: AppConfig = {
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
    },
    ai: {
      provider: (process.env.AI_PROVIDER as 'deepseek' | 'openai' | 'claude' | 'huggingface') || 'deepseek',
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      },
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10),
      },
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY || '',
        model: process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct',
      },
    },
  };

  // Validate required fields based on provider
  if (config.ai.provider === 'deepseek' && !config.ai.deepseek.apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required when using DeepSeek provider');
  }

  if (config.ai.provider === 'claude' && !config.ai.claude.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when using Claude provider');
  }

  if (config.ai.provider === 'huggingface' && !config.ai.huggingface.apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is required when using HuggingFace provider');
  }

  return config;
};

export const config = getConfig();
