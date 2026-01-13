import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';
import path from 'path';

export class GitServer extends BaseMCPServer {
  name = 'git';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_GIT_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    const serverPath = path.join(
      process.cwd(),
      'src/services/mcp/servers/git-mcp-server.ts'
    );

    return {
      name: this.name,
      enabled: true,
      transport: 'stdio',
      command: 'tsx',
      args: [serverPath],
      timeout: 10000,
    };
  }
}
