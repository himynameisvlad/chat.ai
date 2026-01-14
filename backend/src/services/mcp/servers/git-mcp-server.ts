#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { initializeDatabase } from '../../../database/database';
import { PRReviewService } from '../../pr-review.service';

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
  {
    name: 'review_pr',
    description: 'Perform AI-powered code review of a pull request. Analyzes code quality, security, performance, documentation, and validates environment variables against .env.example. Returns detailed feedback with suggestions and critical issues.',
    inputSchema: {
      type: 'object',
      properties: {
        baseBranch: {
          type: 'string',
          description: 'Base branch to compare against (e.g., "main", "origin/main")',
        },
        headBranch: {
          type: 'string',
          description: 'Head branch or commit SHA to review (e.g., "feature-branch", "HEAD")',
        },
        includeCodeQuality: {
          type: 'boolean',
          description: 'Check code quality and maintainability (default: true)',
        },
        includeSecurity: {
          type: 'boolean',
          description: 'Check for security vulnerabilities (default: true)',
        },
        includePerformance: {
          type: 'boolean',
          description: 'Check for performance issues (default: true)',
        },
        includeDocumentation: {
          type: 'boolean',
          description: 'Check documentation completeness (default: true)',
        },
        includeTests: {
          type: 'boolean',
          description: 'Check test coverage and quality (default: true)',
        },
        useRAG: {
          type: 'boolean',
          description: 'Use RAG to fetch relevant documentation for context (default: true)',
        },
      },
      required: ['baseBranch', 'headBranch'],
    },
  },
  {
    name: 'list_active_prs',
    description: 'List all active pull requests in the repository. Returns PR number, title, status, branches, author, and creation date. Use this to discover open PRs that can be reviewed.',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          description: 'Filter by PR state: "open" (default), "closed", "merged", or "all"',
          enum: ['open', 'closed', 'merged', 'all'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of PRs to return (default: 10)',
        },
      },
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

interface ListActivePRsArgs {
  state?: 'open' | 'closed' | 'merged' | 'all';
  limit?: number;
}

async function listActivePRs(args: ListActivePRsArgs = {}): Promise<string> {
  const { state = 'open', limit = 10 } = args;

  console.error(`[Git MCP] Listing ${state} PRs (limit: ${limit})`);

  try {
    // Check if gh CLI is available
    try {
      await executeGitCommand('gh --version', 5000);
    } catch (error) {
      return '❌ GitHub CLI (gh) is not installed or not authenticated.\n\nPlease install: https://cli.github.com/\nThen authenticate: gh auth login';
    }

    // Get PR list in JSON format
    const result = await executeGitCommand(
      `gh pr list --state ${state} --limit ${limit} --json number,title,state,headRefName,baseRefName,author,createdAt,updatedAt,url`,
      15000
    );

    const prs = JSON.parse(result.stdout);

    if (!prs || prs.length === 0) {
      return `ℹ️ No ${state} pull requests found in this repository.`;
    }

    // Format the PRs as markdown
    let output = `## ${state.charAt(0).toUpperCase() + state.slice(1)} Pull Requests (${prs.length})\n\n`;

    for (const pr of prs) {
      const createdDate = new Date(pr.createdAt).toLocaleDateString();
      const updatedDate = new Date(pr.updatedAt).toLocaleDateString();

      output += `### #${pr.number}: ${pr.title}\n\n`;
      output += `- **Status:** ${pr.state}\n`;
      output += `- **Author:** ${pr.author.login}\n`;
      output += `- **Branches:** \`${pr.baseRefName}\` ← \`${pr.headRefName}\`\n`;
      output += `- **Created:** ${createdDate}\n`;
      output += `- **Updated:** ${updatedDate}\n`;
      output += `- **URL:** ${pr.url}\n`;
      output += `- **Review Command:** Use \`review_pr\` tool with \`baseBranch: "${pr.baseRefName}"\` and \`headBranch: "${pr.headRefName}"\`\n\n`;
      output += `---\n\n`;
    }

    return output;
  } catch (error) {
    console.error('[Git MCP] Error listing PRs:', error);
    return `❌ Error listing PRs: ${error instanceof Error ? error.message : String(error)}`;
  }
}

interface ReviewPRArgs {
  baseBranch: string;
  headBranch: string;
  includeCodeQuality?: boolean;
  includeSecurity?: boolean;
  includePerformance?: boolean;
  includeDocumentation?: boolean;
  includeTests?: boolean;
  useRAG?: boolean;
}

async function reviewPR(args: ReviewPRArgs): Promise<string> {
  const {
    baseBranch,
    headBranch,
    includeCodeQuality = true,
    includeSecurity = true,
    includePerformance = true,
    includeDocumentation = true,
    includeTests = true,
    useRAG = true,
  } = args;

  console.error(`[Git MCP] Performing PR review: ${baseBranch}...${headBranch}`);

  // Initialize database
  await initializeDatabase();

  // Create review service
  const reviewService = new PRReviewService();

  // Perform review
  const result = await reviewService.reviewPR({
    baseBranch,
    headBranch,
    analysisOptions: {
      includeCodeQuality,
      includeSecurity,
      includePerformance,
      includeDocumentation,
      includeTests,
      useRAG,
      ragThreshold: 0.5,
      ragTopN: 3,
    },
  });

  // Format result as markdown
  let markdown = `# 🤖 AI Code Review\n\n`;

  // Summary
  markdown += `## Summary\n\n${result.summary}\n\n`;

  // Statistics
  markdown += `## 📊 Statistics\n\n`;
  markdown += `- **Files Changed:** ${result.statistics.filesChanged}\n`;
  markdown += `- **Lines Added:** ${result.statistics.linesAdded}\n`;
  markdown += `- **Lines Deleted:** ${result.statistics.linesDeleted}\n`;
  markdown += `- **Commits:** ${result.statistics.commitsCount}\n`;
  markdown += `- **Review Duration:** ${Math.round(result.statistics.reviewDurationMs / 1000)}s\n\n`;

  // Positive Points
  if (result.positivePoints && result.positivePoints.length > 0) {
    markdown += `## ✅ Positive Points\n\n`;
    result.positivePoints.forEach((point: string) => {
      markdown += `- ${point}\n`;
    });
    markdown += '\n';
  }

  // Suggestions
  if (result.suggestions && result.suggestions.length > 0) {
    markdown += `## 💡 Suggestions\n\n`;
    result.suggestions.forEach((suggestion: any) => {
      const location = suggestion.line
        ? `\`${suggestion.file}:${suggestion.line}\``
        : `\`${suggestion.file}\``;
      markdown += `- **${location}** [${suggestion.category}]\n`;
      markdown += `  ${suggestion.message}\n\n`;
    });
  }

  // Critical Issues
  if (result.criticalIssues && result.criticalIssues.length > 0) {
    markdown += `## 🔴 Critical Issues\n\n`;
    result.criticalIssues.forEach((issue: any) => {
      const location = issue.line
        ? `\`${issue.file}:${issue.line}\``
        : `\`${issue.file}\``;
      markdown += `- **${location}** [${issue.category}]\n`;
      markdown += `  ${issue.message}\n\n`;
    });
  } else {
    markdown += `## 🟢 No Critical Issues Found\n\n`;
  }

  // Relevant Documentation
  if (result.relevantDocumentation && result.relevantDocumentation.length > 0) {
    markdown += `## 📚 Relevant Documentation\n\n`;
    result.relevantDocumentation.forEach((doc: any, idx: number) => {
      markdown += `${idx + 1}. **${doc.filename}** (relevance: ${(doc.relevanceScore * 100).toFixed(1)}%)\n`;
    });
    markdown += '\n';
  }

  // Metadata
  markdown += `---\n\n`;
  markdown += `<sub>`;
  markdown += `🤖 Reviewed by ${result.metadata.model}`;
  if (result.metadata.ragUsed) {
    markdown += ` • 📚 RAG-enhanced`;
  }
  markdown += ` • ⏱️ ${new Date(result.metadata.timestamp).toLocaleString()}`;
  markdown += `</sub>\n`;

  return markdown;
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
      case 'review_pr':
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments for review_pr');
        }
        result = await reviewPR(args as unknown as ReviewPRArgs);
        break;
      case 'list_active_prs':
        result = await listActivePRs(args as unknown as ListActivePRsArgs);
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
