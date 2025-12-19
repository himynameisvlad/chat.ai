export interface MCPServerConfigStdio {
  name: string;
  enabled: boolean;
  transport: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPServerConfigHTTP {
  name: string;
  enabled: boolean;
  transport: 'http';
  url: string;
}

export type MCPServerConfig = MCPServerConfigStdio | MCPServerConfigHTTP;

import { mcpServers } from './servers';

class MCPConfigService {
  private servers: MCPServerConfig[] = [];
  private initialized = false;

  getServers(): MCPServerConfig[] {
    if (!this.initialized) {
      this.loadServers();
    }
    return this.servers;
  }

  isEnabled(): boolean {
    return this.getServers().length > 0;
  }

  private loadServers(): void {
    this.servers = [];

    for (const server of mcpServers) {
      const config = server.getConfig();
      if (config) {
        this.servers.push(config);
      }
    }

    this.initialized = true;
  }

  addServer(server: MCPServerConfig): void {
    this.servers.push(server);
  }

  getEnabledServers(): MCPServerConfig[] {
    return this.getServers().filter(server => server.enabled);
  }
}

export const mcpConfigService = new MCPConfigService();
