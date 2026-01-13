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
  {
    name: 'git_pr_diff',
    description: 'Get the diff between two branches or commits. Useful for analyzing PR changes.',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: 'Base branch or commit (e.g., "main", "origin/main", commit hash)',
        },
        head: {
          type: 'string',
          description: 'Head branch or commit to compare (e.g., "feature-branch", commit hash)',
        },
        filesOnly: {
          type: 'boolean',
          description: 'If true, only return list of changed files without full diff',
        },
      },
      required: ['base', 'head'],
    },
  },
  {
    name: 'git_pr_changed_files',
    description: 'Get list of files changed between two branches with their change type (added, modified, deleted)',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: 'Base branch or commit',
        },
        head: {
          type: 'string',
          description: 'Head branch or commit',
        },
      },
      required: ['base', 'head'],
    },
  },
  {
    name: 'git_pr_file_content',
    description: 'Get the content of a specific file at a specific branch or commit',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file',
        },
        ref: {
          type: 'string',
          description: 'Branch name or commit hash (e.g., "main", "HEAD", commit hash)',
        },
      },
      required: ['filePath', 'ref'],
    },
  },
  {
    name: 'git_compare_branches',
    description: 'Compare two branches and get detailed statistics about changes',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: 'Base branch',
        },
        head: {
          type: 'string',
          description: 'Head branch to compare',
        },
      },
      required: ['base', 'head'],
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

interface GitDiffArgs {
  base: string;
  head: string;
  filesOnly?: boolean;
}

async function getPRDiff(args: GitDiffArgs): Promise<string> {
  const { base, head, filesOnly = false } = args;

  if (filesOnly) {
    const result = await executeGitCommand(
      `git diff --name-only ${base}...${head}`,
      30000
    );
    const files = result.stdout.trim().split('\n').filter(Boolean);

    return `## Changed Files (${files.length})

${files.map((file) => `- ${file}`).join('\n')}`;
  }

  const result = await executeGitCommand(`git diff ${base}...${head}`, 60000);
  const diffOutput = result.stdout.trim();

  if (!diffOutput) {
    return `## No Changes\n\nNo differences found between \`${base}\` and \`${head}\`.`;
  }

  return `## Diff: ${base}...${head}

\`\`\`diff
${diffOutput}
\`\`\``;
}

interface GitChangedFilesArgs {
  base: string;
  head: string;
}

async function getChangedFiles(args: GitChangedFilesArgs): Promise<string> {
  const { base, head } = args;

  const result = await executeGitCommand(
    `git diff --name-status ${base}...${head}`,
    30000
  );
  const output = result.stdout.trim();

  if (!output) {
    return `## No Changed Files\n\nNo files changed between \`${base}\` and \`${head}\`.`;
  }

  const lines = output.split('\n');
  const changes = lines.map((line) => {
    const [status, ...fileParts] = line.split('\t');
    const file = fileParts.join('\t');

    const statusMap: Record<string, string> = {
      A: '➕ Added',
      M: '📝 Modified',
      D: '🗑️ Deleted',
      R: '🔄 Renamed',
      C: '📋 Copied',
    };

    const statusText = statusMap[status[0]] || status;
    return { status: statusText, file };
  });

  const grouped = {
    added: changes.filter((c) => c.status.includes('Added')),
    modified: changes.filter((c) => c.status.includes('Modified')),
    deleted: changes.filter((c) => c.status.includes('Deleted')),
    other: changes.filter(
      (c) =>
        !c.status.includes('Added') &&
        !c.status.includes('Modified') &&
        !c.status.includes('Deleted')
    ),
  };

  let markdown = `## Changed Files: ${base}...${head}\n\n`;
  markdown += `**Total:** ${changes.length} file(s)\n\n`;

  if (grouped.added.length > 0) {
    markdown += `### ➕ Added (${grouped.added.length})\n`;
    markdown += grouped.added.map((c) => `- ${c.file}`).join('\n') + '\n\n';
  }

  if (grouped.modified.length > 0) {
    markdown += `### 📝 Modified (${grouped.modified.length})\n`;
    markdown += grouped.modified.map((c) => `- ${c.file}`).join('\n') + '\n\n';
  }

  if (grouped.deleted.length > 0) {
    markdown += `### 🗑️ Deleted (${grouped.deleted.length})\n`;
    markdown += grouped.deleted.map((c) => `- ${c.file}`).join('\n') + '\n\n';
  }

  if (grouped.other.length > 0) {
    markdown += `### Other Changes (${grouped.other.length})\n`;
    markdown += grouped.other.map((c) => `- ${c.status}: ${c.file}`).join('\n') + '\n\n';
  }

  return markdown.trim();
}

interface GitFileContentArgs {
  filePath: string;
  ref: string;
}

async function getFileContent(args: GitFileContentArgs): Promise<string> {
  const { filePath, ref } = args;

  try {
    const result = await executeGitCommand(`git show ${ref}:${filePath}`, 30000);
    const content = result.stdout;

    const extension = filePath.split('.').pop() || '';
    const language = extension || 'text';

    return `## File: ${filePath} (ref: ${ref})

\`\`\`${language}
${content}
\`\`\``;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('does not exist') || errorMsg.includes('exists on disk, but not in')) {
      return `## File Not Found\n\nFile \`${filePath}\` does not exist at ref \`${ref}\`.`;
    }
    throw error;
  }
}

interface GitCompareBranchesArgs {
  base: string;
  head: string;
}

async function compareBranches(args: GitCompareBranchesArgs): Promise<string> {
  const { base, head } = args;

  const statsResult = await executeGitCommand(
    `git diff --stat ${base}...${head}`,
    30000
  );
  const stats = statsResult.stdout.trim();

  const shortstatResult = await executeGitCommand(
    `git diff --shortstat ${base}...${head}`,
    30000
  );
  const shortstat = shortstatResult.stdout.trim();

  const commitCountResult = await executeGitCommand(
    `git rev-list --count ${base}..${head}`,
    30000
  );
  const commitCount = commitCountResult.stdout.trim();

  const commitsResult = await executeGitCommand(
    `git log --oneline ${base}..${head}`,
    30000
  );
  const commits = commitsResult.stdout.trim();

  return `## Branch Comparison: ${base}...${head}

### Summary

- **Commits ahead:** ${commitCount}
- ${shortstat || 'No changes'}

### Statistics

\`\`\`
${stats || 'No file changes'}
\`\`\`

### Commits

\`\`\`
${commits || 'No commits'}
\`\`\``;
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
      case 'git_pr_diff':
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments for git_pr_diff');
        }
        result = await getPRDiff(args as unknown as GitDiffArgs);
        break;
      case 'git_pr_changed_files':
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments for git_pr_changed_files');
        }
        result = await getChangedFiles(args as unknown as GitChangedFilesArgs);
        break;
      case 'git_pr_file_content':
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments for git_pr_file_content');
        }
        result = await getFileContent(args as unknown as GitFileContentArgs);
        break;
      case 'git_compare_branches':
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments for git_compare_branches');
        }
        result = await compareBranches(args as unknown as GitCompareBranchesArgs);
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
