#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const tools = [
  {
    name: 'docker_run',
    description: 'Run a new Docker container',
    inputSchema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'Docker image to run',
        },
        name: {
          type: 'string',
          description: 'Container name',
        },
        command: {
          type: 'string',
          description: 'Command to run in the container',
        },
        detach: {
          type: 'boolean',
          description: 'Run container in background (default: true)',
        },
        rm: {
          type: 'boolean',
          description: 'Automatically remove container when it exits (default: false)',
        },
        env: {
          type: 'object',
          description: 'Environment variables as key-value pairs',
        },
        ports: {
          type: 'array',
          description: 'Port mappings (e.g., ["8080:80", "443:443"])',
        },
        volumes: {
          type: 'array',
          description: 'Volume mappings (e.g., ["/host/path:/container/path"])',
        },
      },
      required: ['image'],
    },
  },
  {
    name: 'docker_exec',
    description: 'Execute a command in a running container',
    inputSchema: {
      type: 'object',
      properties: {
        container: {
          type: 'string',
          description: 'Container ID or name',
        },
        command: {
          type: 'string',
          description: 'Command to execute',
        },
      },
      required: ['container', 'command'],
    },
  },
  {
    name: 'docker_ps',
    description: 'List Docker containers',
    inputSchema: {
      type: 'object',
      properties: {
        all: {
          type: 'boolean',
          description: 'Show all containers (default: false shows just running)',
        },
      },
    },
  },
  {
    name: 'docker_stop',
    description: 'Stop a running container',
    inputSchema: {
      type: 'object',
      properties: {
        container: {
          type: 'string',
          description: 'Container ID or name to stop',
        },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_logs',
    description: 'Fetch logs from a container',
    inputSchema: {
      type: 'object',
      properties: {
        container: {
          type: 'string',
          description: 'Container ID or name',
        },
        tail: {
          type: 'number',
          description: 'Number of lines to show from the end of the logs',
        },
        follow: {
          type: 'boolean',
          description: 'Follow log output (default: false)',
        },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_rm',
    description: 'Remove a container',
    inputSchema: {
      type: 'object',
      properties: {
        container: {
          type: 'string',
          description: 'Container ID or name to remove',
        },
        force: {
          type: 'boolean',
          description: 'Force removal of running container (default: false)',
        },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_pull',
    description: 'Pull a Docker image from registry',
    inputSchema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'Image name to pull (e.g., "nginx:latest")',
        },
      },
      required: ['image'],
    },
  },
  {
    name: 'docker_images',
    description: 'List Docker images',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'docker_inspect',
    description: 'Return detailed information about a container',
    inputSchema: {
      type: 'object',
      properties: {
        container: {
          type: 'string',
          description: 'Container ID or name',
        },
      },
      required: ['container'],
    },
  },
];

async function executeDockerCommand(command: string, timeoutMs = 120000) {
  console.error('[Docker MCP] Executing:', command);
  try {
    const result = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });
    return result;
  } catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Command timed out after ${timeoutMs}ms`);
    }

    // Provide detailed error information
    const errorDetails = [];
    if (error.code) errorDetails.push(`Exit code: ${error.code}`);
    if (error.stderr) errorDetails.push(`stderr: ${error.stderr}`);
    if (error.stdout) errorDetails.push(`stdout: ${error.stdout}`);

    const errorMessage = errorDetails.length > 0
      ? errorDetails.join('\n')
      : error.message;

    throw new Error(`Docker command failed: ${command}\n${errorMessage}`);
  }
}

async function dockerRun(args: any) {
  const parts = ['docker', 'run'];

  if (args.detach) parts.push('-d');
  if (args.rm) parts.push('--rm');
  if (args.name) parts.push('--name', escapeArg(args.name));

  if (args.env) {
    Object.entries(args.env).forEach(([key, value]) => {
      parts.push('-e', `${escapeArg(key)}=${escapeArg(value as string)}`);
    });
  }

  if (args.ports) {
    args.ports.forEach((port: string) => {
      parts.push('-p', escapeArg(port));
    });
  }

  if (args.volumes) {
    args.volumes.forEach((volume: string) => {
      parts.push('-v', escapeArg(volume));
    });
  }

  parts.push(escapeArg(args.image));

  if (args.command) {
    parts.push(args.command);
  }

  const cmd = parts.join(' ');
  const { stdout, stderr } = await executeDockerCommand(cmd);
  return stdout.trim() || stderr.trim() || 'Container started successfully';
}

async function dockerExec(args: any) {
  const cmd = `docker exec ${escapeArg(args.container)} sh -c ${escapeArg(
    args.command
  )}`;
  const { stdout, stderr } = await executeDockerCommand(cmd);
  return stdout || stderr;
}

async function dockerPs(args: any) {
  const allFlag = args.all ? '-a' : '';
  const cmd = `docker ps ${allFlag} --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Image}}"`;
  const { stdout } = await executeDockerCommand(cmd);
  return stdout;
}

async function dockerStop(args: any) {
  const cmd = `docker stop ${escapeArg(args.container)}`;
  const { stdout } = await executeDockerCommand(cmd);
  return `Stopped container: ${stdout.trim()}`;
}

async function dockerLogs(args: any) {
  const tailArg = args.tail ? `--tail ${args.tail}` : '';
  const followArg = args.follow ? '-f' : '';
  const cmd = `docker logs ${tailArg} ${followArg} ${escapeArg(args.container)}`;
  const { stdout, stderr } = await executeDockerCommand(cmd);
  return stdout || stderr;
}

async function dockerRm(args: any) {
  const forceArg = args.force ? '-f' : '';
  const cmd = `docker rm ${forceArg} ${escapeArg(args.container)}`;
  const { stdout } = await executeDockerCommand(cmd);
  return `Removed container: ${stdout.trim()}`;
}

async function dockerPull(args: any) {
  const cmd = `docker pull ${escapeArg(args.image)}`;
  // Pulling images can take a long time, use 10 minute timeout
  const { stdout, stderr } = await executeDockerCommand(cmd, 600000);
  return stdout || stderr;
}

async function dockerImages() {
  const cmd = `docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.Size}}"`;
  const { stdout } = await executeDockerCommand(cmd);
  return stdout;
}

async function dockerInspect(args: any) {
  const cmd = `docker inspect ${escapeArg(args.container)}`;
  const { stdout } = await executeDockerCommand(cmd);
  return stdout;
}

function escapeArg(arg: string): string {
  // Escape special characters for shell
  return `"${arg.replace(/"/g, '\\"')}"`;
}

const server = new Server(
  {
    name: 'docker-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'docker_run':
        result = await dockerRun(args);
        break;
      case 'docker_exec':
        result = await dockerExec(args);
        break;
      case 'docker_ps':
        result = await dockerPs(args);
        break;
      case 'docker_stop':
        result = await dockerStop(args);
        break;
      case 'docker_logs':
        result = await dockerLogs(args);
        break;
      case 'docker_rm':
        result = await dockerRm(args);
        break;
      case 'docker_pull':
        result = await dockerPull(args);
        break;
      case 'docker_images':
        result = await dockerImages();
        break;
      case 'docker_inspect':
        result = await dockerInspect(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Docker MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in Docker MCP Server:', error);
  process.exit(1);
});
