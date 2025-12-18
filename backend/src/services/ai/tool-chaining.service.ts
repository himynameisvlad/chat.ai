import OpenAI from 'openai';
import { Message, StreamResponse, DEFAULT_TEMPERATURE } from '../../types';
import { mcpToolsService } from '../mcp';

interface ToolCall {
  name: string;
  arguments: string;
}

interface StreamResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason?: string;
}

export class ToolChainingService {
  constructor(private client: OpenAI, private model: string, private maxTokens: number) {}

  async executeWithToolChaining(
    messages: Message[],
    response: StreamResponse,
    temperature?: number,
    tools?: OpenAI.Chat.ChatCompletionTool[],
    options: {
      maxIterations?: number;
      verbose?: boolean;
    } = {}
  ): Promise<void> {
    const { maxIterations = 5, verbose = true } = options;

    const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    let conversationMessages = [...formattedMessages];
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      if (verbose && iteration > 1) {
        response.write(`data: ${JSON.stringify({ text: `\n🔄 Chain iteration ${iteration}\n\n` })}\n\n`);
      }

      const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
        model: this.model,
        messages: conversationMessages,
        stream: true,
        temperature: temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: this.maxTokens,
      };

      if (tools && tools.length > 0) {
        requestParams.tools = tools;
        requestParams.tool_choice = 'auto';
      }

      const stream = await this.client.chat.completions.create(requestParams);
      const result = await this.processStream(stream, response);

      // If no tool calls, AI has finished
      if (!result.toolCalls || result.toolCalls.length === 0) {
        response.write('data: [DONE]\n\n');
        response.end();
        return;
      }

      // Add assistant message with tool calls to conversation
      conversationMessages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls.map((tc, index) => ({
          id: `call_${Date.now()}_${index}`,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      });

      // Execute tool calls
      response.write(`data: ${JSON.stringify({ text: '\n\n🔧 Executing tools...\n\n' })}\n\n`);

      for (const toolCall of result.toolCalls) {
        try {
          const args = JSON.parse(toolCall.arguments);
          console.log(`[Chain ${iteration}] Tool: ${toolCall.name}`, args);

          const toolResult = await mcpToolsService.executeTool(toolCall.name, args);

          response.write(`data: ${JSON.stringify({ text: `✓ ${toolCall.name}\n` })}\n\n`);

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool' as const,
            tool_call_id: `call_${Date.now()}_${result.toolCalls.indexOf(toolCall)}`,
            content: JSON.stringify(toolResult),
          });

          // Stream result to user
          if (verbose) {
            const resultStr = JSON.stringify(toolResult, null, 2);
            response.write(`data: ${JSON.stringify({ text: `\n${resultStr}\n\n` })}\n\n`);
          }
        } catch (error) {
          console.error(`Error executing tool ${toolCall.name}:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';

          response.write(`data: ${JSON.stringify({ text: `✗ ${toolCall.name}: ${errorMsg}\n\n` })}\n\n`);

          // Add error to conversation
          conversationMessages.push({
            role: 'tool' as const,
            tool_call_id: `call_${Date.now()}_${result.toolCalls.indexOf(toolCall)}`,
            content: JSON.stringify({ error: errorMsg }),
          });
        }
      }

      response.write(`data: ${JSON.stringify({ text: '\n' })}\n\n`);
    }

    // Max iterations reached
    response.write(`data: ${JSON.stringify({ text: '\n⚠️ Max iterations reached. Tool chaining stopped.\n' })}\n\n`);
    response.write('data: [DONE]\n\n');
    response.end();
  }

  private async processStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    response: StreamResponse
  ): Promise<StreamResult> {
    const toolCalls: Record<number, { name: string; arguments: string }> = {};
    let content = '';
    let finishReason: string | undefined;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const deltaContent = choice?.delta?.content;

      if (deltaContent) {
        content += deltaContent;
        response.write(`data: ${JSON.stringify({ text: deltaContent })}\n\n`);
      }

      if (choice?.delta?.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          const index = toolCall.index;
          if (!toolCalls[index]) {
            toolCalls[index] = { name: '', arguments: '' };
          }

          if (toolCall.function?.name) {
            toolCalls[index].name = toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            toolCalls[index].arguments += toolCall.function.arguments;
          }
        }
      }

      if (chunk.usage) {
        const tokenData = JSON.stringify({
          type: 'token_usage',
          usage: {
            prompt_tokens: chunk.usage.prompt_tokens || 0,
            completion_tokens: chunk.usage.completion_tokens || 0,
            total_tokens: chunk.usage.total_tokens || 0,
          },
        });
        response.write(`data: ${tokenData}\n\n`);
      }

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    const toolCallsArray = Object.values(toolCalls).filter((tc) => tc.name);

    return {
      content,
      toolCalls: toolCallsArray,
      finishReason,
    };
  }
}
