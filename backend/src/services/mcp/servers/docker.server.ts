import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';
import path from 'path';

export class DockerServer extends BaseMCPServer {
  name = 'docker';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_DOCKER_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    const serverPath = path.join(process.cwd(), 'dist/services/mcp/servers/docker-mcp-server.js');

    return {
      name: this.name,
      enabled: true,
      transport: 'stdio',
      command: 'node',
      args: [serverPath],
      timeout: 600000,
    };
  }
}
