/**
 * Application configuration
 * Centralized configuration management for the frontend
 */

interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
  };
}

export const config: AppConfig = {
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    timeout: 30000, // 30 seconds
  },
};
