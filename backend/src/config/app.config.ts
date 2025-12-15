import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface MCPServerConfig {
  name: string;
  enabled: boolean;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface AppConfig {
  server: {
    port: number;
  };
  database: {
    path: string;
  };
  mcp: {
    enabled: boolean;
    servers: MCPServerConfig[];
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
  const mcpServers: MCPServerConfig[] = [];

  // Google Maps MCP Server
  if (process.env.MCP_GOOGLE_MAPS_ENABLED === 'true') {
    const googleMapsEnv: Record<string, string> = {};
    if (process.env.MCP_GOOGLE_MAPS_API_KEY) {
      googleMapsEnv.GOOGLE_MAPS_API_KEY = process.env.MCP_GOOGLE_MAPS_API_KEY;
    }

    mcpServers.push({
      name: 'google-maps',
      enabled: true,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
      env: Object.keys(googleMapsEnv).length > 0 ? googleMapsEnv : undefined,
    });
  }

  // Add more MCP servers here as needed
  // Example:
  // if (process.env.MCP_CUSTOM_SERVER_ENABLED === 'true') {
  //   mcpServers.push({
  //     name: 'custom-server',
  //     enabled: true,
  //     command: 'npx',
  //     args: ['-y', '@modelcontextprotocol/server-custom'],
  //     env: { API_KEY: process.env.MCP_CUSTOM_API_KEY },
  //   });
  // }

  const config: AppConfig = {
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
    },
    database: {
      path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'chat.db'),
    },
    mcp: {
      enabled: mcpServers.length > 0,
      servers: mcpServers,
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
