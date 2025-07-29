import { z } from "zod";

// Agent thought process schema
export const AgentThoughtSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  type: z.enum(["reasoning", "tool_selection", "error_analysis", "retry_decision"]),
  content: z.string(),
  confidence: z.number().min(0).max(1),
});

export type AgentThought = z.infer<typeof AgentThoughtSchema>;

// Tool definition schema
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  requiredFileTypes: z.array(z.string()),
  parameters: z.record(z.any()).optional(),
});

export type Tool = z.infer<typeof ToolSchema>;

// Tool execution result schema
export const ToolExecutionResultSchema = z.object({
  toolName: z.string(),
  success: z.boolean(),
  output: z.any().optional(),
  error: z.string().optional(),
  artifacts: z.array(z.object({
    name: z.string(),
    type: z.enum(["chart", "csv", "json", "text"]),
    content: z.string(),
  })).optional(),
});

export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;

// Agent state schema
export const AgentStateSchema = z.object({
  sessionId: z.string(),
  thoughts: z.array(AgentThoughtSchema),
  currentStep: z.number(),
  maxSteps: z.number().default(10),
  status: z.enum(["thinking", "executing", "completed", "failed"]),
  finalResult: ToolExecutionResultSchema.optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// Analysis config schema (for the predefined scripts)
export const AnalysisConfigSchema = z.object({
  scriptType: z.enum(["helium", "keywords", "channels"]),
  requiredColumns: z.array(z.string()).optional(),
  validIntents: z.array(z.string()).optional(),
  brandKeywords: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
});

export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>; 