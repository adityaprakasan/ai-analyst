import { AgentState, AgentThought } from "@/lib/agent/schemas";
import { Brain, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentThoughtsProps {
  state: AgentState | null;
  className?: string;
}

export function AgentThoughts({ state, className }: AgentThoughtsProps) {
  if (!state) return null;

  const getThoughtIcon = (thought: AgentThought) => {
    switch (thought.type) {
      case "reasoning":
        return <Brain className="w-4 h-4 text-blue-500" />;
      case "tool_selection":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error_analysis":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "retry_decision":
        return <RefreshCw className="w-4 h-4 text-orange-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (state.status) {
      case "thinking":
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Thinking...</span>
          </div>
        );
      case "executing":
        return (
          <div className="flex items-center gap-2 text-orange-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Executing...</span>
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Completed</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Failed</span>
          </div>
        );
    }
  };

  return (
    <div className={cn("bg-gray-50 rounded-lg p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Agent Reasoning</h3>
        {getStatusBadge()}
      </div>
      
      <div className="space-y-2">
        {state.thoughts.map((thought) => (
          <div
            key={thought.id}
            className="flex items-start gap-3 p-3 bg-white rounded-md border border-gray-200"
          >
            <div className="flex-shrink-0 mt-0.5">
              {getThoughtIcon(thought)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{thought.content}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-gray-500">
                  {new Date(thought.timestamp).toLocaleTimeString()}
                </span>
                {thought.confidence < 1 && (
                  <span className="text-xs text-gray-500">
                    Confidence: {Math.round(thought.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {state.currentStep > 0 && (
        <div className="text-xs text-gray-500 text-right">
          Step {state.currentStep} of {state.maxSteps}
        </div>
      )}
    </div>
  );
} 