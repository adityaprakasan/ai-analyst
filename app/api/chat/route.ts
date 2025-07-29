import { z } from "zod";
import { getModelClient, LLMModel, LLMModelConfig } from "@/lib/model";
import { toPrompt } from "@/lib/prompt";
import { CustomFiles } from "@/lib/types";
import { AgentController } from "@/lib/agent/controller";
import { AgentState } from "@/lib/agent/schemas";
import {
  streamText,
  convertToCoreMessages,
  Message,
  LanguageModelV1,
  tool,
} from "ai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const {
    messages,
    data,
  }: {
    messages: Message[];
    data: { files: CustomFiles[]; model: LLMModel; config: LLMModelConfig };
  } = await req.json();
  // Filter out tool invocations
  const filteredMessages = messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: undefined,
      };
    }
    return message;
  });

  const { model, apiKey, ...modelParams } = data.config;

  const modelClient = getModelClient(data.model, data.config);

  // Check if this is an analysis request with files
  const lastMessage = messages[messages.length - 1];
  const isAnalysisRequest = data.files.length > 0 && 
    (lastMessage?.content.toLowerCase().includes('analyze') || 
     lastMessage?.content.toLowerCase().includes('analysis') ||
     lastMessage?.content.toLowerCase().includes('chart') ||
     lastMessage?.content.toLowerCase().includes('plot'));

  if (isAnalysisRequest) {
    // Use the agent controller for analysis requests
    const sessionId = `session-${Date.now()}`;
    const agentController = new AgentController(sessionId, data.model, data.config);
    
    const result = await streamText({
      system: `You are an AI assistant that helps with data analysis. When the user asks for analysis, use the analyzeData tool to process their request.`,
      model: modelClient as LanguageModelV1,
      messages: convertToCoreMessages(filteredMessages),
      ...modelParams,
      tools: {
        analyzeData: tool({
          description: "Analyze CSV data using predefined scripts or custom code",
          parameters: z.object({
            query: z.string().describe("The analysis query from the user"),
          }),
          execute: async ({ query }) => {
            const agentState = await agentController.processQuery(query, data.files);
            return agentState;
          },
        }),
      },
      toolChoice: "required",
    });

    return result.toDataStreamResponse();
  } else {
    // Regular chat without analysis
    const result = await streamText({
      system: toPrompt(data),
      model: modelClient as LanguageModelV1,
      messages: convertToCoreMessages(filteredMessages),
      ...modelParams,
    });

    return result.toDataStreamResponse();
  }
}
