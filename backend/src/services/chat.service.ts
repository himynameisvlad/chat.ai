import { IAIProvider } from '../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError, HISTORY_THRESHOLD, RECENT_MESSAGES_COUNT, MAX_MESSAGE_LENGTH } from '../types';
import { summaryRepository } from '../database/summary.repository';
import { mcpToolsService, mcpConfigService } from './mcp';
import { DeepSeekService } from './ai/deepseek.service';
import { embeddingRepository } from '../database/embedding.repository';
import { OllamaService } from './ollama.service';
import { cosineSimilarity } from '../utils/vector.utils';

export class ChatService {
  constructor(
    private aiProvider: IAIProvider,
    private deepSeekProvider?: IAIProvider
  ) {}

  /**
   * Processes a chat request and streams the response
   * @param conversationHistory - Previous messages in the conversation
   * @param newMessage - The new message from the user
   * @param response - Express response object for streaming
   * @param customPrompt - Optional custom system prompt
   * @param temperature - Optional temperature parameter for AI response
   */
  async processChat(
    conversationHistory: Message[],
    newMessage: string,
    response: StreamResponse,
    customPrompt?: string,
    temperature?: number
  ): Promise<void> {
    this.validateMessage(newMessage);

    const processedHistory = await this.processHistory(conversationHistory);
    const messages = this.buildConversation(processedHistory, newMessage);

    const mcpEnabled = mcpConfigService.isEnabled() && mcpToolsService.hasTools();
    const tools = mcpEnabled ? mcpToolsService.convertToOpenAIFormat() : undefined;

    // If primary provider is DeepSeek and MCP is enabled, use chaining
    if (mcpEnabled && this.aiProvider instanceof DeepSeekService) {
      console.log('🔧 Using DeepSeek (primary) with MCP tools and chaining enabled');
      await this.aiProvider.streamChatWithChaining(
        messages,
        response,
        customPrompt,
        temperature,
        tools,
        { maxIterations: 25, verbose: true }
      );
    }
    // If MCP is enabled but primary provider is not DeepSeek, use DeepSeek fallback WITHOUT chaining
    else if (mcpEnabled && this.deepSeekProvider) {
      console.log('🔧 Using DeepSeek (fallback) with MCP tools without chaining');
      await this.deepSeekProvider.streamChat(messages, response, customPrompt, temperature, tools);
    }
    // No MCP or no tools, use primary provider
    else {
      await this.aiProvider.streamChat(messages, response, customPrompt, temperature, tools);
    }
  }

  async getResponse(message: string): Promise<string> {
    this.validateMessage(message);

    const messages = this.buildConversation([], message);
    const mcpEnabled = mcpConfigService.isEnabled() && mcpToolsService.hasTools();
    const provider = (mcpEnabled && this.deepSeekProvider) ? this.deepSeekProvider : this.aiProvider;
    const tools = mcpEnabled ? mcpToolsService.convertToOpenAIFormat() : undefined;

    if (mcpEnabled) {
      console.log('🔧 Using DeepSeek with MCP tools for response generation');
    }

    return new Promise((resolve, reject) => {
      let responseText = '';

      const mockResponse = {
        setHeader: () => {},
        write: (data: string) => {
          if (data.startsWith('data: ') && !data.includes('[DONE]') && !data.includes('token_usage')) {
            try {
              const jsonStr = data.slice(6).trim();
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                responseText += parsed.text;
              }
            } catch (error) {
              console.error('Failed to parse response chunk:', error);
            }
          }
        },
        end: () => resolve(responseText),
        on: () => {},
        headersSent: false,
        closed: false,
        writable: true
      } as unknown as StreamResponse;

      provider.streamChat(messages, mockResponse, undefined, undefined, tools).catch(reject);
    });
  }

  private async handleToolsListRequest(response: StreamResponse): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    if (!mcpConfigService.isEnabled() || !mcpToolsService.hasTools()) {
      const message = 'No MCP tools are currently available. Enable MCP servers in configuration to use tools.';
      response.write(`data: ${JSON.stringify({ text: message })}\n\n`);
      response.write('data: [DONE]\n\n');
      response.end();
      return;
    }

    const tools = mcpToolsService.getTools();

    // Group tools by server
    const toolsByServer = tools.reduce((acc, tool) => {
      if (!acc[tool.serverName]) {
        acc[tool.serverName] = [];
      }
      acc[tool.serverName].push(tool);
      return acc;
    }, {} as Record<string, typeof tools>);

    let responseText = `🛠️ Available MCP Tools (${tools.length}):\n\n`;

    Object.entries(toolsByServer).forEach(([serverName, serverTools]) => {
      responseText += `**${serverName}** (${serverTools.length} tools):\n`;
      serverTools.forEach((tool, index) => {
        responseText += `  ${index + 1}. **${tool.name}**\n`;
        if (tool.description) {
          responseText += `     ${tool.description}\n`;
        }
      });
      responseText += '\n';
    });

    response.write(`data: ${JSON.stringify({ text: responseText })}\n\n`);
    response.write('data: [DONE]\n\n');
    response.end();
  }

  /**
   * Validates the user's message
   */
  private validateMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new AppError(400, 'Message is required and cannot be empty');
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new AppError(400, `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
    }
  }

  /**
   * Builds the complete conversation including history and new message
   */
  private buildConversation(
    conversationHistory: Message[],
    newMessage: string
  ): Message[] {
    return [
      ...conversationHistory,
      {
        role: 'user' as const,
        content: newMessage,
      },
    ];
  }

  private async processHistory(history: Message[]): Promise<Message[]> {
    const existingSummary = await summaryRepository.getLatestSummary();

    if (history.length <= HISTORY_THRESHOLD) {
      if (existingSummary) {
        return [
          { role: 'system' as const, content: existingSummary.summary_text },
          ...history
        ];
      }
      return history;
    }

    const oldMessages = history.slice(0, -RECENT_MESSAGES_COUNT);
    const recentMessages = history.slice(-RECENT_MESSAGES_COUNT);

    let summary: string;

    if (existingSummary && existingSummary.message_count >= oldMessages.length - 2) {
      summary = existingSummary.summary_text;
    } else {
      summary = await this.summarizeMessages(oldMessages);
      await summaryRepository.saveSummary(summary, oldMessages.length);
    }

    return [
      { role: 'system' as const, content: summary },
      ...recentMessages
    ];
  }

  private async summarizeMessages(messages: Message[]): Promise<string> {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Summarize this conversation concisely in 2-3 sentences. It's important to memorize and retain all critical information, key facts, and important context from the conversation:\n\n${conversationText}`;

    return new Promise((resolve, reject) => {
      let summary = '';

      const mockResponse = {
        setHeader: () => {},
        write: (data: string) => {
          if (data.startsWith('data: ') && !data.includes('[DONE]') && !data.includes('token_usage')) {
            try {
              const jsonStr = data.slice(6).trim();
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                summary += parsed.text;
              }
            } catch {}
          }
        },
        end: () => resolve(summary),
        headersSent: false,
        closed: false,
        writable: true
      } as unknown as StreamResponse;

      this.aiProvider.streamChat(
        [{ role: 'user', content: summaryPrompt }],
        mockResponse
      ).catch(reject);
    });
  }

  /**
   * Research RAG - compares AI responses with and without reranking
   * @param query - User's question
   * @param topN - Number of top relevant chunks to retrieve
   * @param threshold - Minimum relevance score (0-1) for including chunks
   * @param initialTopK - Number of candidates to retrieve before reranking
   * @returns Object with both responses (with reranking and without reranking)
   */
  async researchRAG(
    query: string,
    topN: number = 3,
    threshold: number = 0.5,
    initialTopK: number = 20
  ): Promise<{
    responseWithReranking: string;
    responseWithoutReranking: string;
    chunksWithReranking: Array<{
      text: string;
      similarity: number;
      filename: string;
      relevanceScore: number;
    }>;
    chunksWithoutReranking: Array<{
      text: string;
      similarity: number;
      filename: string;
    }>;
    metadata: {
      totalChunks: number;
      chunksAboveThreshold: {
        withReranking: number;
        withoutReranking: number;
      };
      chunksUsed: {
        withReranking: number;
        withoutReranking: number;
      };
      threshold: number;
    };
  }> {
    this.validateMessage(query);

    // Initialize Ollama service for embeddings
    const ollamaService = new OllamaService();

    // Check if Ollama is available
    const isOllamaAvailable = await ollamaService.ping();
    if (!isOllamaAvailable) {
      throw new AppError(503, 'Ollama service is not available. Please ensure Ollama is running.');
    }

    // Generate embedding for the query
    const queryEmbedding = await ollamaService.generateEmbedding(query);

    // Get all embeddings from database
    const allEmbeddings = await embeddingRepository.getAllEmbeddings();

    if (allEmbeddings.length === 0) {
      throw new AppError(404, 'No embeddings found in database. Please process some PDF files first.');
    }

    // Calculate similarity for each embedding and sort by similarity
    const similarities = allEmbeddings
      .map(emb => ({
        ...emb,
        similarity: cosineSimilarity(queryEmbedding, emb.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Get initial candidates
    const candidates = similarities.slice(0, Math.min(initialTopK, similarities.length));

    // Path 1: WITHOUT reranking - use cosine similarity threshold
    const chunksWithoutReranking = candidates
      .filter(c => c.similarity >= threshold)
      .slice(0, topN)
      .map(s => ({
        text: s.chunk_text || '',
        similarity: s.similarity,
        filename: s.filename
      }));

    // Path 2: WITH reranking - use LLM-based relevance scoring
    console.log(`🔄 Reranking ${candidates.length} candidates...`);
    console.log('📋 Candidates with cosine similarity:');
    candidates.forEach((c, i) => {
      console.log(`  [${i}] CosSim: ${c.similarity.toFixed(3)} - "${c.chunk_text?.substring(0, 80)}..."`);
    });

    const documents = candidates.map(c => c.chunk_text || '');
    const rerankResults = await ollamaService.rerank(query, documents);

    console.log('🎯 Reranking results (sorted by LLM score):');
    rerankResults.forEach((r, i) => {
      console.log(`  [${i}] LLM: ${r.relevanceScore.toFixed(3)} | CosSim: ${candidates[r.index].similarity.toFixed(3)} - "${candidates[r.index].chunk_text?.substring(0, 80)}..."`);
    });
    console.log(`📊 Threshold: ${threshold}, chunks above: ${rerankResults.filter(r => r.relevanceScore >= threshold).length}`);

    const chunksWithReranking = rerankResults
      .map(result => ({
        ...candidates[result.index],
        relevanceScore: result.relevanceScore,
        text: candidates[result.index].chunk_text || '',
        filename: candidates[result.index].filename
      }))
      .filter(chunk => chunk.relevanceScore >= threshold)
      .slice(0, topN)
      .map(chunk => ({
        text: chunk.text,
        similarity: chunk.similarity,
        filename: chunk.filename,
        relevanceScore: chunk.relevanceScore
      }));

    // Prepare metadata
    const metadata = {
      totalChunks: allEmbeddings.length,
      chunksAboveThreshold: {
        withReranking: rerankResults.filter(r => r.relevanceScore >= threshold).length,
        withoutReranking: similarities.filter(s => s.similarity >= threshold).length
      },
      chunksUsed: {
        withReranking: chunksWithReranking.length,
        withoutReranking: chunksWithoutReranking.length
      },
      threshold
    };

    // Generate response WITHOUT reranking
    let responseWithoutReranking: string;
    if (chunksWithoutReranking.length === 0) {
      responseWithoutReranking = 'No relevant information found above the similarity threshold.';
    } else {
      const contextWithoutReranking = chunksWithoutReranking
        .map((chunk, idx) => `[Chunk ${idx + 1} from ${chunk.filename} (Similarity: ${chunk.similarity.toFixed(2)})]:\n${chunk.text}`)
        .join('\n\n');

      const promptWithoutReranking = `Based on the following context, please answer the question.

Context:
${contextWithoutReranking}

Question: ${query}

Answer:`;

      responseWithoutReranking = await this.getResponse(promptWithoutReranking);
    }

    // Generate response WITH reranking
    let responseWithReranking: string;
    if (chunksWithReranking.length === 0) {
      responseWithReranking = 'No relevant information found above the relevance threshold.';
    } else {
      const contextWithReranking = chunksWithReranking
        .map((chunk, idx) => `[Chunk ${idx + 1} from ${chunk.filename} (Relevance: ${chunk.relevanceScore.toFixed(2)})]:\n${chunk.text}`)
        .join('\n\n');

      const promptWithReranking = `Based on the following context, please answer the question.

Context:
${contextWithReranking}

Question: ${query}

Answer:`;

      responseWithReranking = await this.getResponse(promptWithReranking);
    }

    return {
      responseWithReranking,
      responseWithoutReranking,
      chunksWithReranking,
      chunksWithoutReranking,
      metadata
    };
  }

  /**
   * Returns the name of the current AI provider
   */
  getProviderName(): string {
    return this.aiProvider.getProviderName();
  }
}
