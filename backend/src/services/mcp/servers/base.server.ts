import { MCPServerConfig } from '../mcp.config';

export interface IMCPServer {
  readonly name: string;
  isEnabled(): boolean;
  getConfig(): MCPServerConfig | null;
}

export abstract class BaseMCPServer implements IMCPServer {
  abstract name: string;

  abstract isEnabled(): boolean;

  abstract getConfig(): MCPServerConfig | null;

  protected getEnvVar(key: string, defaultValue?: string): string {
    return process.env[key] || defaultValue || '';
  }

  protected getEnvBool(key: string): boolean {
    const value = process.env[key];
    if (!value) return false;
    // Support multiple formats: 'true', 'True', 'TRUE', '1', 'yes'
    return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
  }
}
