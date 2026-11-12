export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
};

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolRun = (name: string, args: unknown) => Promise<string>;

export type AiInput = { system: string; messages: ChatMessage[]; tools: ToolDef[]; runTool: ToolRun };
export type AiResult = { text: string; toolsUsed?: { name: string; ok: boolean }[] };

export interface AiProvider {
  mode: 'demo' | 'claude';
  respond(input: AiInput): Promise<AiResult>;
}
