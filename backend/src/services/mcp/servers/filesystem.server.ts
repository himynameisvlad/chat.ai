import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';

export class FilesystemServer extends BaseMCPServer {
  name = 'filesystem';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_FILESYSTEM_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    const allowedDirs = this.getEnvVar('MCP_FILESYSTEM_ALLOWED_DIRS', process.cwd());

    return {
      name: this.name,
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', allowedDirs],
    };
  }
}
