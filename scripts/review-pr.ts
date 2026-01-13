#!/usr/bin/env tsx
import { PRReviewService } from '../backend/src/services/pr-review.service';
import { initializeDatabase } from '../backend/src/database/database';
import { mcpInitializationService, mcpToolsService } from '../backend/src/services/mcp';
import { Octokit } from '@octokit/rest';

interface PRInfo {
  owner: string;
  repo: string;
  prNumber: number;
  baseBranch: string;
  headBranch: string;
}

async function getPRInfo(): Promise<PRInfo> {
  const githubContext = {
    owner: process.env.GITHUB_REPOSITORY_OWNER || '',
    repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || '',
    prNumber: parseInt(process.env.PR_NUMBER || '0'),
    baseBranch: process.env.BASE_BRANCH || 'main',
    headBranch: process.env.HEAD_BRANCH || '',
  };

  if (!githubContext.owner || !githubContext.repo || !githubContext.prNumber) {
    throw new Error(
      'Missing required environment variables: GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY, PR_NUMBER'
    );
  }

  return githubContext;
}

async function postReviewComment(
  prInfo: PRInfo,
  reviewMarkdown: string
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN not found. Cannot post comment.');
    console.log('\n📝 Review Result:\n');
    console.log(reviewMarkdown);
    return;
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.issues.createComment({
      owner: prInfo.owner,
      repo: prInfo.repo,
      issue_number: prInfo.prNumber,
      body: reviewMarkdown,
    });

    console.log('✅ Review comment posted to PR successfully');
  } catch (error) {
    console.error('❌ Failed to post comment to PR:', error);
    console.log('\n📝 Review Result:\n');
    console.log(reviewMarkdown);
  }
}

function formatReviewAsMarkdown(result: any): string {
  let markdown = `## 🤖 AI Code Review\n\n`;

  // Summary
  markdown += `### Summary\n\n${result.summary}\n\n`;

  // Statistics
  markdown += `### 📊 Statistics\n\n`;
  markdown += `- **Files Changed:** ${result.statistics.filesChanged}\n`;
  markdown += `- **Lines Added:** ${result.statistics.linesAdded}\n`;
  markdown += `- **Lines Deleted:** ${result.statistics.linesDeleted}\n`;
  markdown += `- **Commits:** ${result.statistics.commitsCount}\n`;
  markdown += `- **Review Duration:** ${Math.round(result.statistics.reviewDurationMs / 1000)}s\n\n`;

  // Positive Points
  if (result.positivePoints.length > 0) {
    markdown += `### ✅ Positive Points\n\n`;
    result.positivePoints.forEach((point: string) => {
      markdown += `- ${point}\n`;
    });
    markdown += '\n';
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    markdown += `### 💡 Suggestions\n\n`;
    result.suggestions.forEach((suggestion: any) => {
      const location = suggestion.line
        ? `\`${suggestion.file}:${suggestion.line}\``
        : `\`${suggestion.file}\``;
      markdown += `- **${location}** [${suggestion.category}]\n`;
      markdown += `  ${suggestion.message}\n`;
      if (suggestion.suggestion) {
        markdown += `  💭 _${suggestion.suggestion}_\n`;
      }
      markdown += '\n';
    });
  }

  // Critical Issues
  if (result.criticalIssues.length > 0) {
    markdown += `### 🔴 Critical Issues\n\n`;
    result.criticalIssues.forEach((issue: any) => {
      const location = issue.line
        ? `\`${issue.file}:${issue.line}\``
        : `\`${issue.file}\``;
      markdown += `- **${location}** [${issue.category}]\n`;
      markdown += `  ${issue.message}\n`;
      if (issue.suggestion) {
        markdown += `  💭 _${issue.suggestion}_\n`;
      }
      markdown += '\n';
    });
  } else {
    markdown += `### 🟢 No Critical Issues Found\n\n`;
  }

  // Relevant Documentation
  if (result.relevantDocumentation?.length > 0) {
    markdown += `### 📚 Relevant Documentation\n\n`;
    result.relevantDocumentation.forEach((doc: any, idx: number) => {
      markdown += `${idx + 1}. **${doc.filename}** (relevance: ${(doc.relevanceScore * 100).toFixed(1)}%)\n`;
      markdown += `   ${doc.section}\n\n`;
    });
  }

  // Metadata
  markdown += `---\n\n`;
  markdown += `<sub>`;
  markdown += `🤖 Reviewed by AI (${result.metadata.model})`;
  if (result.metadata.ragUsed) {
    markdown += ` • 📚 RAG-enhanced`;
  }
  markdown += ` • ⏱️ ${new Date(result.metadata.timestamp).toLocaleString()}`;
  markdown += `</sub>\n`;

  return markdown;
}

async function main() {
  console.log('🚀 Starting PR Review Process...\n');

  try {
    // Step 1: Get PR information
    console.log('📋 Getting PR information...');
    const prInfo = await getPRInfo();
    console.log(`   Owner: ${prInfo.owner}`);
    console.log(`   Repo: ${prInfo.repo}`);
    console.log(`   PR: #${prInfo.prNumber}`);
    console.log(`   Base: ${prInfo.baseBranch}`);
    console.log(`   Head: ${prInfo.headBranch}\n`);

    // Step 2: Initialize database
    console.log('🗄️  Initializing database...');
    await initializeDatabase();
    console.log('   ✓ Database initialized\n');

    // Step 3: Initialize MCP services
    console.log('🔧 Initializing MCP services...');
    await mcpInitializationService.initialize();

    // Check what servers and tools are loaded
    const connectedServers = mcpInitializationService.getConnectedServers();
    console.log(`   Connected servers: ${connectedServers.join(', ') || 'none'}`);

    if (!mcpInitializationService.hasTools()) {
      console.error('   ❌ No MCP tools loaded!');
      console.error('   Make sure MCP_GIT_ENABLED=true is set');
      process.exit(1);
    }

    const tools = mcpToolsService.getTools();
    console.log(`   Available tools: ${tools.map(t => t.name).join(', ')}`);
    console.log('   ✓ MCP services initialized\n');

    // Step 4: Create review service
    console.log('🔍 Creating PR review service...');
    const reviewService = new PRReviewService();
    console.log('   ✓ Review service created\n');

    // Step 5: Perform review
    console.log('🤖 Analyzing PR...');
    const result = await reviewService.reviewPR({
      baseBranch: prInfo.baseBranch,
      headBranch: prInfo.headBranch,
      prNumber: prInfo.prNumber,
      analysisOptions: {
        includeCodeQuality: true,
        includeSecurity: true,
        includePerformance: true,
        includeDocumentation: true,
        includeTests: true,
        useRAG: true,
        ragThreshold: 0.5,
        ragTopN: 3,
      },
    });
    console.log('   ✓ Analysis complete\n');

    // Step 6: Format and post review
    console.log('📤 Posting review to PR...');
    const markdown = formatReviewAsMarkdown(result);
    await postReviewComment(prInfo, markdown);

    console.log('\n✅ PR Review completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PR Review failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
