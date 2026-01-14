import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';
import path from 'path';
import fs from 'fs';

export class DockerServer extends BaseMCPServer {
  name = 'docker';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_DOCKER_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    // Try multiple possible paths (for different execution contexts)
    const possiblePaths = [
      path.join(process.cwd(), 'backend/src/services/mcp/servers/docker-mcp-server.ts'), // From project root
      path.join(process.cwd(), 'src/services/mcp/servers/docker-mcp-server.ts'), // From backend dir
      path.join(__dirname, 'docker-mcp-server.ts'), // Relative to this file (compiled)
    ];

    // Find the first path that exists
    let serverPath = possiblePaths[0];
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        serverPath = possiblePath;
        break;
      }
    }

    console.log(`[Docker Server] Using path: ${serverPath}`);

    return {
      name: this.name,
      enabled: true,
      transport: 'stdio',
      command: 'tsx',
      args: [serverPath],
      timeout: 600000,
    };
  }
}
