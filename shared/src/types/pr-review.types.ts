export interface ReviewComment {
  file: string;
  line?: number;
  severity: 'info' | 'warning' | 'error';
  category: 'code_quality' | 'security' | 'performance' | 'documentation' | 'tests' | 'best_practices';
  message: string;
  suggestion?: string;
}

export interface PRAnalysisRequest {
  baseBranch: string;
  headBranch: string;
  prNumber?: number;
  analysisOptions?: AnalysisOptions;
}

export interface AnalysisOptions {
  includeCodeQuality?: boolean;
  includeSecurity?: boolean;
  includePerformance?: boolean;
  includeDocumentation?: boolean;
  includeTests?: boolean;
  useRAG?: boolean;
  ragThreshold?: number;
  ragTopN?: number;
}

export interface PRReviewResult {
  summary: string;
  positivePoints: string[];
  suggestions: ReviewComment[];
  criticalIssues: ReviewComment[];
  relevantDocumentation: RelevantDoc[];
  statistics: PRStatistics;
  metadata: ReviewMetadata;
}

export interface RelevantDoc {
  filename: string;
  section: string;
  content: string;
  relevanceScore: number;
}

export interface PRStatistics {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  commitsCount: number;
  reviewDurationMs: number;
}

export interface ReviewMetadata {
  timestamp: string;
  reviewerId: string;
  model: string;
  ragUsed: boolean;
  analysisOptionsApplied: AnalysisOptions;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PRDiffInfo {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  commits: CommitInfo[];
}

export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface ReviewPromptContext {
  diff: string;
  changedFiles: FileChange[];
  relevantDocs?: RelevantDoc[];
  prDescription?: string;
  analysisOptions: AnalysisOptions;
}
