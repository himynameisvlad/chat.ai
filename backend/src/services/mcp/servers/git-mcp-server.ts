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
    name: 'git_current_branch',
    description: 'Get the current git branch name and last commit information',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function executeGitCommand(command: string, timeoutMs = 10000) {
  console.error('[Git MCP] Executing:', command);
  try {
    const result = await execAsync(command, {
      timeout: timeoutMs,
    });
    return result;
  } catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Command timed out after ${timeoutMs}ms`);
    }

    const errorDetails = [];
    if (error.code) errorDetails.push(`Exit code: ${error.code}`);
    if (error.stderr) errorDetails.push(`stderr: ${error.stderr}`);
    if (error.stdout) errorDetails.push(`stdout: ${error.stdout}`);

    const errorMessage =
      errorDetails.length > 0 ? errorDetails.join('\n') : error.message;

    throw new Error(`Git command failed: ${command}\n${errorMessage}`);
  }
}

async function getCurrentBranch(): Promise<string> {
  const branchResult = await executeGitCommand('git branch --show-current');
  const branchName = branchResult.stdout.trim();

  const logResult = await executeGitCommand(
    'git log -1 --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso'
  );
  const commitInfo = logResult.stdout.trim();

  if (!commitInfo) {
    return `## Current Branch\n\n**${branchName}**\n\nNo commits yet.`;
  }

  const [hash, author, email, date, message] = commitInfo.split('|');

  return `## Current Branch

**${branchName}**

### Last Commit

- **Hash**: \`${hash.substring(0, 7)}\` (${hash})
- **Author**: ${author} <${email}>
- **Date**: ${date}
- **Message**: ${message}
`;
}

const server = new Server(
  {
    name: 'git-server',
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
      case 'git_current_branch':
        result = await getCurrentBranch();
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
    console.error('[Git MCP] Error:', errorMessage);
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
  console.error('Git MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in Git MCP Server:', error);
  process.exit(1);
});
