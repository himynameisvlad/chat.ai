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

    if (process.env.MCP_POKEMON_SERVER_ENABLED === 'true') {
      this.servers.push({
        name: 'pokemon',
        enabled: true,
        transport: 'http',
        url: process.env.MCP_POKEMON_SERVER_URL || '',
      });
    }

    if (process.env.MCP_FILESYSTEM_ENABLED === 'true') {
      const allowedDirs = process.env.MCP_FILESYSTEM_ALLOWED_DIRS || process.cwd();
      this.servers.push({
        name: 'filesystem',
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', allowedDirs],
      });
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
