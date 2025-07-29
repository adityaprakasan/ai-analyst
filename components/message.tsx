import { Message } from "ai";
import { BotIcon, UserIcon } from "lucide-react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ToolOutput } from "./tooloutput";
import { ToolResult } from "../lib/types";
import { AgentThoughts } from "./agent-thoughts";
import { AgentState } from "@/lib/agent/schemas";

export function MessageComponent({ message }: { message: Message }) {
  return (
    <div
      key={message.id}
      className={`px-4 ${message.role === "user" ? "bg-orange-50" : ""}`}
    >
      <div
        className={`flex gap-4 mx-auto w-full max-w-2xl py-4 ${
          message.role === "user" ? "items-center" : ""
        }`}
      >
        <div className="h-fit rounded-md flex items-center justify-center">
          {message.role === "user" ? (
            <UserIcon className="mt-1 w-6 h-6 text-orange-500" />
          ) : (
            <BotIcon className="mt-1 w-6 h-6 text-orange-500" />
          )}
        </div>
        <div className="overflow-hidden flex-1 flex flex-col gap-2">
          <Markdown
            components={{
              code(props) {
                const { children, className, ...rest } = props;
                const match = /language-(\w+)/.exec(className || "");
                return match ? (
                  <SyntaxHighlighter
                    PreTag="div"
                    className="border text-sm !rounded-xl"
                    language={match[1]}
                    style={oneLight}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code {...rest} className={className}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </Markdown>
          <ToolOutput result={message.toolInvocations as ToolResult} />
          {message.toolInvocations?.[0] && 
           'result' in message.toolInvocations[0] &&
           message.toolInvocations[0].toolName === 'analyzeData' && (
            <AgentThoughts 
              state={message.toolInvocations[0].result as AgentState} 
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
}
