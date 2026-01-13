import {
  PRAnalysisRequest,
  PRReviewResult,
  ReviewComment,
  RelevantDoc,
  PRStatistics,
  ReviewMetadata,
  FileChange,
  AnalysisOptions,
} from '@chat-ai/shared';
import { mcpToolsService } from './mcp';
import OpenAI from 'openai';

const DEFAULT_ANALYSIS_OPTIONS: Required<AnalysisOptions> = {
  includeCodeQuality: true,
  includeSecurity: true,
  includePerformance: true,
  includeDocumentation: true,
  includeTests: true,
  useRAG: true,
  ragThreshold: 0.5,
  ragTopN: 3,
};

export class PRReviewService {
  private deepseekClient: OpenAI;
  private modelName: string;

  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }

    this.deepseekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
    this.modelName = 'deepseek-chat';
    console.log('[PR Review] Using DeepSeek API');
  }

  async reviewPR(request: PRAnalysisRequest): Promise<PRReviewResult> {
    const startTime = Date.now();
    const options = { ...DEFAULT_ANALYSIS_OPTIONS, ...request.analysisOptions };

    console.log(
      `[PR Review] Starting review for ${request.baseBranch}...${request.headBranch}`
    );

    try {
      // Step 1: Get PR diff and files using Git MCP
      const { diff, changedFiles, statistics } = await this.getPRInfo(
        request.baseBranch,
        request.headBranch
      );

      // Step 2: Get relevant documentation using RAG (if enabled)
      let relevantDocs: RelevantDoc[] = [];
      if (options.useRAG) {
        relevantDocs = await this.getRelevantDocumentation(diff, options);
      }

      // Step 3: Analyze PR with LLM
      const reviewResult = await this.analyzeWithLLM(
        diff,
        changedFiles,
        relevantDocs,
        options
      );

      // Step 4: Build final result
      const result: PRReviewResult = {
        ...reviewResult,
        statistics: {
          ...statistics,
          reviewDurationMs: Date.now() - startTime,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          reviewerId: 'ai-reviewer',
          model: this.modelName,
          ragUsed: options.useRAG && relevantDocs.length > 0,
          analysisOptionsApplied: options,
        },
      };

      console.log(
        `[PR Review] Completed in ${result.statistics.reviewDurationMs}ms`
      );
      return result;
    } catch (error) {
      console.error('[PR Review] Error:', error);
      throw error;
    }
  }

  private async getPRInfo(
    baseBranch: string,
    headBranch: string
  ): Promise<{
    diff: string;
    changedFiles: FileChange[];
    statistics: Omit<PRStatistics, 'reviewDurationMs'>;
  }> {
    console.log('[PR Review] Fetching PR information via Git MCP');

    // Get diff using Git MCP tool
    const diffResult = await this.callGitMCPTool('git_pr_diff', {
      base: baseBranch,
      head: headBranch,
      filesOnly: false,
    });

    // Get changed files with status
    const filesResult = await this.callGitMCPTool('git_pr_changed_files', {
      base: baseBranch,
      head: headBranch,
    });

    // Get comparison statistics
    const compareResult = await this.callGitMCPTool('git_compare_branches', {
      base: baseBranch,
      head: headBranch,
    });

    // Parse files from the result
    const changedFiles = this.parseChangedFiles(filesResult);

    // Parse statistics from compare result
    const statistics = this.parseStatistics(compareResult, changedFiles.length);

    return {
      diff: diffResult,
      changedFiles,
      statistics,
    };
  }

  private async callGitMCPTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    try {
      const result = await mcpToolsService.executeTool(toolName, args);

      if (result.isError) {
        throw new Error(`Git MCP tool error: ${result.content[0]?.text || 'Unknown error'}`);
      }

      return result.content[0]?.text || '';
    } catch (error) {
      console.error(`[PR Review] Error calling Git MCP tool ${toolName}:`, error);
      throw error;
    }
  }

  private parseChangedFiles(filesResult: string): FileChange[] {
    const files: FileChange[] = [];
    const lines = filesResult.split('\n');

    let currentSection: 'added' | 'modified' | 'deleted' | null = null;

    for (const line of lines) {
      if (line.includes('### ➕ Added')) {
        currentSection = 'added';
      } else if (line.includes('### 📝 Modified')) {
        currentSection = 'modified';
      } else if (line.includes('### 🗑️ Deleted')) {
        currentSection = 'deleted';
      } else if (line.startsWith('- ') && currentSection) {
        const filePath = line.substring(2).trim();
        files.push({
          path: filePath,
          status: currentSection,
          additions: 0,
          deletions: 0,
        });
      }
    }

    return files;
  }

  private parseStatistics(
    compareResult: string,
    filesChanged: number
  ): Omit<PRStatistics, 'reviewDurationMs'> {
    // Parse insertions (may or may not be present)
    const insertionsMatch = compareResult.match(/(\d+) insertions?\(\+\)/);
    const linesAdded = insertionsMatch ? parseInt(insertionsMatch[1]) : 0;

    // Parse deletions (may or may not be present)
    const deletionsMatch = compareResult.match(/(\d+) deletions?\(-\)/);
    const linesDeleted = deletionsMatch ? parseInt(deletionsMatch[1]) : 0;

    // Parse commits count
    const commitsMatch = compareResult.match(/Commits ahead:\*\* (\d+)/);
    const commitsCount = commitsMatch ? parseInt(commitsMatch[1]) : 0;

    console.log(`[PR Review] Parsed stats: +${linesAdded} -${linesDeleted}, ${commitsCount} commits`);

    return {
      filesChanged,
      linesAdded,
      linesDeleted,
      commitsCount,
    };
  }

  private async getRelevantDocumentation(
    diff: string,
    options: Required<AnalysisOptions>
  ): Promise<RelevantDoc[]> {
    console.log('[PR Review] Fetching relevant documentation via RAG MCP');

    try {
      // Generate query based on diff
      const query = this.generateRAGQuery(diff);

      // Call RAG MCP tool
      const result = await mcpToolsService.executeTool('rag_query', {
        query,
        topN: options.ragTopN,
        threshold: options.ragThreshold,
      });

      if (result.isError) {
        console.warn('[PR Review] RAG MCP returned error:', result.content[0]?.text);
        return [];
      }

      // Parse RAG MCP response
      return this.parseRAGResponse(result.content[0]?.text || '');
    } catch (error) {
      console.error('[PR Review] RAG MCP query failed:', error);
      return [];
    }
  }

  private parseRAGResponse(ragText: string): RelevantDoc[] {
    const docs: RelevantDoc[] = [];

    try {
      // Parse markdown response from RAG MCP server
      const resultMatches = ragText.matchAll(/## Result (\d+): (.+?)\n\n\*\*Chunk:\*\* (\d+)\n\*\*Relevance Score:\*\* ([\d.]+)[\s\S]*?\n\n([\s\S]*?)(?=\n---|\n## |$)/g);

      for (const match of resultMatches) {
        const [, , filename, chunkIndex, relevanceScore, content] = match;
        docs.push({
          filename: filename.trim(),
          section: `Chunk ${chunkIndex}`,
          content: content.trim(),
          relevanceScore: parseFloat(relevanceScore),
        });
      }
    } catch (error) {
      console.error('[PR Review] Failed to parse RAG response:', error);
    }

    return docs;
  }

  private generateRAGQuery(diff: string): string {
    const diffLines = diff.split('\n').slice(0, 50).join('\n');
    return `Code changes and implementation patterns: ${diffLines}`;
  }

  private async analyzeWithLLM(
    diff: string,
    changedFiles: FileChange[],
    relevantDocs: RelevantDoc[],
    options: Required<AnalysisOptions>
  ): Promise<Omit<PRReviewResult, 'statistics' | 'metadata'>> {
    console.log('[PR Review] Analyzing with DeepSeek LLM');

    const prompt = this.buildReviewPrompt(diff, changedFiles, relevantDocs, options);

    const completion = await this.deepseekClient.chat.completions.create({
      model: this.modelName,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    return this.parseReviewResponse(responseText, relevantDocs);
  }

  private getSystemPrompt(): string {
    return `You are an expert code reviewer AI. Your task is to analyze pull requests and provide constructive, actionable feedback.

Focus on:
- Code quality and maintainability
- Security vulnerabilities
- Performance considerations
- Documentation completeness
- Test coverage
- Best practices and design patterns

Provide feedback in a structured format:
1. Summary: Brief overview of the changes
2. Positive Points: What was done well
3. Suggestions: Improvements with specific file locations and line numbers where possible
4. Critical Issues: Serious problems that must be addressed

Be constructive, specific, and helpful. Reference the provided documentation when relevant.`;
  }

  private buildReviewPrompt(
    diff: string,
    changedFiles: FileChange[],
    relevantDocs: RelevantDoc[],
    options: Required<AnalysisOptions>
  ): string {
    let prompt = `Please review this pull request:\n\n`;

    prompt += `## Changed Files (${changedFiles.length})\n`;
    prompt += changedFiles.map((f) => `- [${f.status}] ${f.path}`).join('\n');
    prompt += '\n\n';

    prompt += `## Diff\n\`\`\`diff\n${diff.slice(0, 8000)}\n\`\`\`\n\n`;

    if (relevantDocs.length > 0) {
      prompt += `## Relevant Documentation\n`;
      relevantDocs.forEach((doc, idx) => {
        prompt += `### ${idx + 1}. ${doc.filename} (relevance: ${doc.relevanceScore.toFixed(2)})\n`;
        prompt += `${doc.content.slice(0, 500)}\n\n`;
      });
    }

    prompt += `## Analysis Focus\n`;
    const focus = [];
    if (options.includeCodeQuality) focus.push('Code Quality');
    if (options.includeSecurity) focus.push('Security');
    if (options.includePerformance) focus.push('Performance');
    if (options.includeDocumentation) focus.push('Documentation');
    if (options.includeTests) focus.push('Tests');
    prompt += focus.join(', ') + '\n\n';

    prompt += `Please provide your review in the following structure:\n`;
    prompt += `SUMMARY: [brief overview]\n`;
    prompt += `POSITIVE: [bullet points of what's good]\n`;
    prompt += `SUGGESTIONS: [bullet points with file:line references]\n`;
    prompt += `CRITICAL: [bullet points of serious issues]\n`;

    return prompt;
  }

  private parseReviewResponse(
    response: string,
    relevantDocs: RelevantDoc[]
  ): Omit<PRReviewResult, 'statistics' | 'metadata'> {
    const sections = {
      summary: '',
      positivePoints: [] as string[],
      suggestions: [] as ReviewComment[],
      criticalIssues: [] as ReviewComment[],
    };

    const summaryMatch = response.match(/SUMMARY:(.*?)(?=POSITIVE:|$)/s);
    if (summaryMatch) {
      sections.summary = summaryMatch[1].trim();
    }

    const positiveMatch = response.match(/POSITIVE:(.*?)(?=SUGGESTIONS:|$)/s);
    if (positiveMatch) {
      sections.positivePoints = positiveMatch[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-') || line.startsWith('•'))
        .map((line) => line.substring(1).trim())
        .filter(Boolean);
    }

    const suggestionsMatch = response.match(/SUGGESTIONS:(.*?)(?=CRITICAL:|$)/s);
    if (suggestionsMatch) {
      sections.suggestions = this.parseComments(suggestionsMatch[1], 'warning');
    }

    const criticalMatch = response.match(/CRITICAL:(.*?)$/s);
    if (criticalMatch) {
      sections.criticalIssues = this.parseComments(criticalMatch[1], 'error');
    }

    return {
      summary: sections.summary || 'No summary provided',
      positivePoints: sections.positivePoints,
      suggestions: sections.suggestions,
      criticalIssues: sections.criticalIssues,
      relevantDocumentation: relevantDocs,
    };
  }

  private parseComments(
    text: string,
    severity: 'warning' | 'error'
  ): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const lines = text.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      if (!line.startsWith('-') && !line.startsWith('•')) continue;

      const cleanLine = line.substring(1).trim();

      const fileMatch = cleanLine.match(/^(.*?):(\d+)/);

      let file = 'general';
      let lineNumber: number | undefined;
      let message = cleanLine;

      if (fileMatch) {
        file = fileMatch[1];
        lineNumber = parseInt(fileMatch[2]);
        message = cleanLine.substring(fileMatch[0].length).trim();
        if (message.startsWith(':') || message.startsWith('-')) {
          message = message.substring(1).trim();
        }
      }

      comments.push({
        file,
        line: lineNumber,
        severity,
        category: this.categorizeComment(message),
        message,
      });
    }

    return comments;
  }

  private categorizeComment(message: string): ReviewComment['category'] {
    const lower = message.toLowerCase();

    if (
      lower.includes('security') ||
      lower.includes('vulnerability') ||
      lower.includes('injection') ||
      lower.includes('xss')
    ) {
      return 'security';
    }

    if (lower.includes('performance') || lower.includes('optimization') || lower.includes('slow')) {
      return 'performance';
    }

    if (
      lower.includes('test') ||
      lower.includes('coverage') ||
      lower.includes('unit test')
    ) {
      return 'tests';
    }

    if (
      lower.includes('documentation') ||
      lower.includes('comment') ||
      lower.includes('readme')
    ) {
      return 'documentation';
    }

    if (
      lower.includes('pattern') ||
      lower.includes('practice') ||
      lower.includes('convention')
    ) {
      return 'best_practices';
    }

    return 'code_quality';
  }
}
