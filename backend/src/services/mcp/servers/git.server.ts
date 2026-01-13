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

    // Try multiple possible paths (for different execution contexts)
    const possiblePaths = [
      path.join(process.cwd(), 'backend/src/services/mcp/servers/git-mcp-server.ts'), // From project root
      path.join(process.cwd(), 'src/services/mcp/servers/git-mcp-server.ts'), // From backend dir
      path.join(__dirname, 'git-mcp-server.ts'), // Relative to this file (compiled)
    ];

    // Use the first path for now (project root context, which is common in CI)
    const serverPath = possiblePaths[0];

    console.log(`[Git Server] Using path: ${serverPath}`);

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
