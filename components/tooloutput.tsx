import { Result } from "@e2b/code-interpreter";
import { useState } from "react";
import { ToolResult } from "../lib/types";
import { RenderResult } from "./charts";
import { AlertTriangle, ChartNoAxesCombined, FileImage, FileText } from "lucide-react";
import { AgentState } from "@/lib/agent/schemas";

export function ToolOutput({ result }: { result: ToolResult | undefined }) {
  const [viewMode, setViewMode] = useState<"static" | "interactive">(
    "interactive"
  );

  if (!result) return null;
  
  // Check for agent analysis results
  const agentResult = result.find((r) => 
    r.toolName === "analyzeData" && 'result' in r
  )?.result as AgentState;
  if (agentResult?.finalResult) {
    const finalResult = agentResult.finalResult;
    
    if (!finalResult.success) {
      return (
        <div className="text-red-500 border border-red-200 rounded-xl bg-red-500/10 text-sm">
          <div className="flex items-center gap-2 pt-4 px-4">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-semibold">Analysis Error</span>
          </div>
          <pre className="overflow-auto p-4">{finalResult.error}</pre>
        </div>
      );
    }
    
    // Display artifacts from agent analysis
    if (finalResult.artifacts && finalResult.artifacts.length > 0) {
      return (
        <div className="space-y-4">
          {finalResult.artifacts.map((artifact, index) => (
            <div key={index} className="border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-gray-50">
                {artifact.type === 'chart' ? (
                  <FileImage className="w-4 h-4 text-blue-500" />
                ) : (
                  <FileText className="w-4 h-4 text-green-500" />
                )}
                <span className="font-medium text-sm">{artifact.name}</span>
              </div>
              {artifact.type === 'chart' && (
                <div className="p-4">
                  <img 
                    src={`data:image/png;base64,${artifact.content}`} 
                    alt={artifact.name}
                    className="max-w-full h-auto"
                  />
                </div>
              )}
            </div>
          ))}
          {finalResult.output?.summary && (
            <div className="border rounded-xl shadow-sm p-4">
              <h4 className="font-medium text-sm mb-2">Analysis Summary</h4>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
                {JSON.stringify(finalResult.output.summary, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }
    
    // Show message if no artifacts but finalResult exists
    return (
      <div className="text-gray-500 border border-gray-200 rounded-xl bg-gray-50 text-sm p-4">
        Analysis completed but no artifacts were generated. Check the agent thoughts above for details.
      </div>
    );
  }
  
  // Original code for runCode results
  const toolResult = result.find((r) => 
    r.toolName === "runCode" && 'result' in r
  )?.result;

  if (toolResult?.error) {
    return (
      <div className="text-red-500 border border-red-200 rounded-xl bg-red-500/10 text-sm">
        <div className="flex items-center gap-2 pt-4 px-4">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold">Error: {toolResult.error.name}</span>
        </div>
        <pre className="overflow-auto p-4">{toolResult.error.traceback}</pre>
      </div>
    );
  }

  if (!toolResult?.results) return null;

  return toolResult.results.map((result: Result, index: number) => (
    <div key={index} className="flex flex-col border rounded-xl shadow-sm">
      <div className="flex items-center justify-between p-2">
        <div className="p-2 font-semibold text-gray-800 text-sm flex items-center gap-2">
          <ChartNoAxesCombined className="w-4 h-4" />
          {result.extra?.chart.title}
        </div>
        <div className="flex justify-end border rounded-lg overflow-hidden">
          <button
            className={`px-3 py-2 font-semibold text-sm ${
              viewMode === "static" ? "bg-orange-500/10 text-orange-500" : ""
            }`}
            onClick={() => setViewMode("static")}
          >
            Static
          </button>
          <button
            className={`px-3 py-2 font-semibold text-sm ${
              viewMode === "interactive"
                ? "bg-orange-500/10 text-orange-500"
                : ""
            }`}
            onClick={() => setViewMode("interactive")}
          >
            Interactive
          </button>
        </div>
      </div>
      <div className="p-4">
        <RenderResult result={result} viewMode={viewMode} />
      </div>
    </div>
  ));
}
