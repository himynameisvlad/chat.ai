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
    console.log(`[PR Review] RAG options: topN=${options.ragTopN}, threshold=${options.ragThreshold}`);

    try {
      const docs: RelevantDoc[] = [];
      const seenFilenames = new Set<string>();

      // Query 1: Get context based on code changes
      console.log('[PR Review] Query 1: Code changes context');
      const codeQuery = this.generateRAGQuery(diff);
      console.log(`[PR Review] Code query: "${codeQuery.substring(0, 100)}..."`);

      const codeResult = await mcpToolsService.executeTool('rag_query', {
        query: codeQuery,
        topN: options.ragTopN,
        threshold: options.ragThreshold,
      });

      if (!codeResult.isError) {
        const codeDocs = this.parseRAGResponse(codeResult.content[0]?.text || '');
        console.log(`[PR Review] Found ${codeDocs.length} code-related docs`);
        for (const doc of codeDocs) {
          if (!seenFilenames.has(doc.filename)) {
            docs.push(doc);
            seenFilenames.add(doc.filename);
          }
        }
      } else {
        console.warn('[PR Review] Code context query returned error');
      }

      // Query 2: Always get .env.example for environment variable validation
      console.log('[PR Review] Query 2: .env.example for env var validation');
      const envQuery = '.env.example environment variables configuration';
      const envResult = await mcpToolsService.executeTool('rag_query', {
        query: envQuery,
        topN: 2,
        threshold: 0.3,
      });

      if (!envResult.isError) {
        const envDocs = this.parseRAGResponse(envResult.content[0]?.text || '');
        console.log(`[PR Review] Found ${envDocs.length} env-related docs`);
        for (const envDoc of envDocs) {
          if (envDoc.filename.toLowerCase().includes('.env') && !seenFilenames.has(envDoc.filename)) {
            docs.push(envDoc);
            seenFilenames.add(envDoc.filename);
          }
        }
      } else {
        console.warn('[PR Review] .env.example query returned error');
      }

      // Query 3: Get README and documentation files
      console.log('[PR Review] Query 3: README and documentation');
      const readmeQuery = 'README project documentation setup guidelines';
      const readmeResult = await mcpToolsService.executeTool('rag_query', {
        query: readmeQuery,
        topN: 2,
        threshold: 0.4,
      });

      if (!readmeResult.isError) {
        const readmeDocs = this.parseRAGResponse(readmeResult.content[0]?.text || '');
        console.log(`[PR Review] Found ${readmeDocs.length} README/docs`);
        for (const doc of readmeDocs) {
          if ((doc.filename.toLowerCase().includes('readme') || doc.filename.toLowerCase().includes('.md'))
              && !seenFilenames.has(doc.filename)) {
            docs.push(doc);
            seenFilenames.add(doc.filename);
          }
        }
      } else {
        console.warn('[PR Review] README query returned error');
      }

      console.log(`[PR Review] Total RAG documents retrieved: ${docs.length}`);
      console.log(`[PR Review] Document sources: ${docs.map(d => d.filename).join(', ')}`);

      return docs;
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
    // Extract key information from diff to create better query
    const lines = diff.split('\n');
    const keywords = new Set<string>();

    // Extract file paths
    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        const path = line.substring(6).trim();
        if (path && path !== '/dev/null') {
          // Get filename without path
          const filename = path.split('/').pop();
          if (filename) {
            keywords.add(filename.replace(/\.(ts|js|tsx|jsx)$/, ''));
          }
        }
      }

      // Extract function/class names from additions
      if (line.startsWith('+')) {
        // Match function declarations
        const funcMatch = line.match(/function\s+(\w+)/);
        if (funcMatch) keywords.add(funcMatch[1]);

        // Match class declarations
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) keywords.add(classMatch[1]);

        // Match const/let declarations (camelCase identifiers)
        const constMatch = line.match(/(?:const|let|var)\s+([a-z][a-zA-Z0-9]+)/);
        if (constMatch && constMatch[1].length > 3) keywords.add(constMatch[1]);

        // Match import statements
        const importMatch = line.match(/import.*from\s+['"](.+)['"]/);
        if (importMatch) {
          const module = importMatch[1].split('/').pop()?.replace(/\.(ts|js)$/, '');
          if (module) keywords.add(module);
        }
      }
    }

    // Limit keywords and create query
    const topKeywords = Array.from(keywords).slice(0, 10);

    // Get first 200 chars of actual diff content
    const diffContent = lines
      .filter(l => l.startsWith('+') || l.startsWith('-'))
      .slice(0, 5)
      .join('\n')
      .substring(0, 200);

    const query = topKeywords.length > 0
      ? `Code patterns and documentation for: ${topKeywords.join(', ')}. Changes: ${diffContent}`
      : `Code changes and implementation: ${diffContent}`;

    return query;
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

**IMPORTANT: Use the provided documentation**
You will be provided with relevant documentation from the project's knowledge base. USE this documentation to:
- Understand the project's architecture and patterns
- Verify that changes follow established conventions
- Reference existing guidelines and best practices
- Check consistency with documented standards
- Validate environment variables against .env.example

Focus on:
- Code quality and maintainability
- Security vulnerabilities (injection, XSS, authentication, authorization)
- Performance considerations (unnecessary re-renders, memory leaks, N+1 queries)
- Documentation completeness (comments, README updates, API docs)
- Test coverage (unit tests, integration tests, edge cases)
- Best practices and design patterns (as documented in the project)
- **Environment variables**: Check if any new environment variables (process.env.*) are used in the code but NOT documented in .env.example. This is CRITICAL.
- **Consistency**: Verify changes align with project documentation and existing patterns

When reviewing:
1. Reference the provided documentation when relevant
2. Point out deviations from documented patterns
3. Suggest improvements based on project guidelines

Provide feedback in a structured format:
1. Summary: Brief overview of the changes
2. Positive Points: What was done well
3. Suggestions: Improvements with specific file locations and line numbers where possible
4. Critical Issues: Serious problems that must be addressed

**IMPORTANT**: If you find any process.env.VARIABLE_NAME used in the code changes:
1. Check if VARIABLE_NAME exists in the .env.example documentation provided
2. If NOT found in .env.example, add to CRITICAL issues: "Environment variable VARIABLE_NAME used but not documented in .env.example"

Be constructive, specific, and helpful. Reference the provided documentation when relevant.`;
  }

  private buildReviewPrompt(
    diff: string,
    changedFiles: FileChange[],
    relevantDocs: RelevantDoc[],
    options: Required<AnalysisOptions>
  ): string {
    let prompt = `Please review this pull request:\n\n`;

    // Show relevant documentation FIRST so LLM sees it before the code
    if (relevantDocs.length > 0) {
      prompt += `## 📚 Project Documentation (USE THIS CONTEXT)\n\n`;
      prompt += `The following documentation was retrieved from the project knowledge base. Use this to validate the changes:\n\n`;

      relevantDocs.forEach((doc, idx) => {
        prompt += `### Document ${idx + 1}: ${doc.filename}\n`;
        prompt += `**Relevance:** ${(doc.relevanceScore * 100).toFixed(0)}%\n`;
        prompt += `**Content:**\n\`\`\`\n${doc.content.slice(0, 800)}\n\`\`\`\n\n`;
      });

      prompt += `---\n\n`;
    } else {
      prompt += `⚠️ **Note:** No project documentation was found in RAG database. Review based on general best practices.\n\n`;
    }

    prompt += `## Changed Files (${changedFiles.length})\n`;
    prompt += changedFiles.map((f) => `- [${f.status}] ${f.path}`).join('\n');
    prompt += '\n\n';

    prompt += `## Code Changes\n\`\`\`diff\n${diff.slice(0, 8000)}\n\`\`\`\n\n`;

    prompt += `## Analysis Requirements\n`;
    const focus = [];
    if (options.includeCodeQuality) focus.push('✅ Code Quality & Maintainability');
    if (options.includeSecurity) focus.push('🔒 Security Vulnerabilities');
    if (options.includePerformance) focus.push('⚡ Performance Issues');
    if (options.includeDocumentation) focus.push('📝 Documentation Completeness');
    if (options.includeTests) focus.push('🧪 Test Coverage');
    prompt += focus.map(f => `- ${f}`).join('\n') + '\n\n';

    if (relevantDocs.length > 0) {
      prompt += `**Remember:** Reference the provided documentation when reviewing. Check consistency with documented patterns.\n\n`;
    }

    prompt += `## Output Format\n`;
    prompt += `Provide your review in this exact structure:\n\n`;
    prompt += `SUMMARY: [2-3 sentences describing overall changes and quality]\n\n`;
    prompt += `POSITIVE:\n`;
    prompt += `- [What was done well]\n`;
    prompt += `- [Good practices observed]\n\n`;
    prompt += `SUGGESTIONS:\n`;
    prompt += `- path/to/file.ts:123 - [Specific improvement with reasoning]\n`;
    prompt += `- general - [General suggestion if no specific file]\n\n`;
    prompt += `CRITICAL:\n`;
    prompt += `- path/to/file.ts:45 - [Serious issue that must be fixed]\n`;
    prompt += `- general - [Critical issue if no specific location]\n`;

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
