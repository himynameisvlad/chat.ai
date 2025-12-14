import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface AppConfig {
  server: {
    port: number;
  };
  database: {
    path: string;
  };
  ai: {
    provider: 'deepseek' | 'openai' | 'huggingface';
    maxTokens: number;
    deepseek: {
      apiKey: string;
      baseURL: string;
      model: string;
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
    database: {
      path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'chat.db'),
    },
    ai: {
      provider: (process.env.AI_PROVIDER as 'deepseek' | 'openai' | 'huggingface') || 'deepseek',
      maxTokens: parseInt(process.env.MAX_TOKENS || '2048', 10),
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      },
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY || '',
        model: process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct',
      },
    },
  };

  if (config.ai.provider === 'deepseek' && !config.ai.deepseek.apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required when using DeepSeek provider');
  }

  if (config.ai.provider === 'huggingface' && !config.ai.huggingface.apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is required when using HuggingFace provider');
  }

  return config;
};

export const config = getConfig();
