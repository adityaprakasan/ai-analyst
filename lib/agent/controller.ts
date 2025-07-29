import { z } from "zod";
import { 
  AgentState, 
  AgentThought, 
  Tool, 
  ToolExecutionResult,
  AgentStateSchema,
  ToolExecutionResultSchema
} from "./schemas";
import { getModelClient, LLMModel, LLMModelConfig } from "../model";
import { generateText, Message, LanguageModelV1 } from "ai";
import { CustomFiles } from "../types";

// Tool registry
export const AVAILABLE_TOOLS: Tool[] = [
  {
    name: "helium_analysis",
    description: "Analyze traffic metrics over time (organic/paid traffic, keywords, costs) with line and dual-axis charts",
    requiredFileTypes: ["csv"],
  },
  {
    name: "keyword_analysis", 
    description: "Analyze search keywords with intent classification, branded vs non-branded split, traffic/volume metrics",
    requiredFileTypes: ["csv"],
  },
  {
    name: "channel_analysis",
    description: "Analyze traffic by marketing channels (direct, referral, organic/paid search, social, email, display)",
    requiredFileTypes: ["csv"],
  },
  {
    name: "custom_analysis",
    description: "Generate custom Python code for analysis when predefined tools don't match the requirements",
    requiredFileTypes: ["*"],
  },
];

export class AgentController {
  private state: AgentState;
  private model: LLMModel;
  private modelConfig: LLMModelConfig;

  constructor(sessionId: string, model: LLMModel, modelConfig: LLMModelConfig) {
    this.state = {
      sessionId,
      thoughts: [],
      currentStep: 0,
      maxSteps: 10,
      status: "thinking",
    };
    this.model = model;
    this.modelConfig = modelConfig;
  }

  async processQuery(query: string, files: CustomFiles[]): Promise<AgentState> {
    try {
      // Step 1: Analyze the query and files
      await this.addThought({
        type: "reasoning",
        content: `Analyzing user query: "${query}" with ${files.length} file(s) uploaded.`,
        confidence: 1,
      });

      // Step 2: Select appropriate tool
      const selectedTool = await this.selectTool(query, files);
      
      if (!selectedTool) {
        throw new Error("No suitable tool found for the query");
      }

      // Step 3: Execute the tool
      const result = await this.executeTool(selectedTool, query, files);

      // Step 4: Handle errors with retry logic
      if (!result.success && this.state.currentStep < this.state.maxSteps) {
        await this.handleError(result, query, files);
      }

      this.state.status = result.success ? "completed" : "failed";
      this.state.finalResult = result;

      return this.state;
    } catch (error) {
      await this.addThought({
        type: "error_analysis",
        content: `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 1,
      });
      this.state.status = "failed";
      return this.state;
    }
  }

  private async addThought(thought: Omit<AgentThought, "id" | "timestamp">): Promise<void> {
    const newThought: AgentThought = {
      ...thought,
      id: `thought-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.state.thoughts.push(newThought);
    this.state.currentStep++;
  }

  private async selectTool(query: string, files: CustomFiles[]): Promise<Tool | null> {
    const modelClient = getModelClient(this.model, this.modelConfig);
    
    const toolSelectionPrompt = `
You are an AI agent that selects the best tool for data analysis tasks.

Available tools:
${AVAILABLE_TOOLS.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

User query: "${query}"
Files uploaded: ${files.map(f => `${f.name} (${f.contentType})`).join(', ')}

Based on the query and files, select the most appropriate tool. Look for these keywords:

For helium_analysis (traffic analysis):
- traffic, organic, paid, cost, spend, CPC, CTR, impressions, clicks

For keyword_analysis (keyword performance):
- keyword, search term, query, intent, branded, non-branded, performance

For channel_analysis (channel breakdown):
- channel, source, medium, direct, referral, social, email, campaign

If none of these specific patterns match, use custom_analysis.

Important: Focus on the main topic of the query. If the user mentions "keyword" in any form, use keyword_analysis.

Respond with ONLY the tool name, nothing else.`;

    const { text } = await generateText({
      model: modelClient as LanguageModelV1,
      prompt: toolSelectionPrompt,
      temperature: 0.3,
    });

    const selectedToolName = text.trim().toLowerCase();
    const tool = AVAILABLE_TOOLS.find(t => t.name === selectedToolName);

    await this.addThought({
      type: "tool_selection",
      content: tool 
        ? `Selected tool: ${tool.name} - ${tool.description}`
        : `No matching tool found for: ${selectedToolName}`,
      confidence: tool ? 0.9 : 0.3,
    });

    return tool || null;
  }

  private async executeTool(
    tool: Tool, 
    query: string, 
    files: CustomFiles[]
  ): Promise<ToolExecutionResult> {
    await this.addThought({
      type: "reasoning",
      content: `Executing ${tool.name} with ${files.length} file(s)...`,
      confidence: 0.8,
    });

    try {
      // Import the tool executor dynamically to avoid circular dependencies
      const { executeToolInSandbox } = await import("./tool-executor");
      
      const result = await executeToolInSandbox(tool.name, files);
      
      console.log("Tool execution result:", result);
      
      return ToolExecutionResultSchema.parse(result);
    } catch (error) {
      return {
        toolName: tool.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleError(
    failedResult: ToolExecutionResult,
    query: string,
    files: CustomFiles[]
  ): Promise<void> {
    await this.addThought({
      type: "error_analysis",
      content: `Error in ${failedResult.toolName}: ${failedResult.error}. Analyzing for retry...`,
      confidence: 0.7,
    });

    const modelClient = getModelClient(this.model, this.modelConfig);
    
    const retryPrompt = `
Previous execution failed with error: ${failedResult.error}

Should we:
1. Retry with the same tool but adjusted parameters
2. Try a different tool
3. Generate custom code instead
4. Give up and report the error

Respond with ONLY the number (1-4).`;

    const { text } = await generateText({
      model: modelClient as LanguageModelV1,
      prompt: retryPrompt,
      temperature: 0.5,
    });

    const decision = parseInt(text.trim());

    await this.addThought({
      type: "retry_decision",
      content: `Retry decision: ${decision === 1 ? "Retry same tool" : 
                                decision === 2 ? "Try different tool" :
                                decision === 3 ? "Generate custom code" : 
                                "Report error"}`,
      confidence: 0.8,
    });

    if (decision === 3) {
      // Switch to custom code generation
      const customTool = AVAILABLE_TOOLS.find(t => t.name === "custom_analysis");
      if (customTool) {
        const result = await this.executeTool(customTool, query, files);
        this.state.finalResult = result;
      }
    }
  }

  getState(): AgentState {
    return this.state;
  }
} 