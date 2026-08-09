import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../../platform/platform-settings/platform-settings.service';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { WhatsAppAssistantToolsService } from './whatsapp-assistant-tools.service';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1024;
const MAX_TOOL_TURNS = 4;

const NOT_CONFIGURED_MESSAGE =
  "The AI assistant isn't set up yet — ask your school's Super Admin to add an Anthropic API key in Platform Settings. " +
  'In the meantime you can text:\n\nLEAVE <type> <start YYYY-MM-DD> <end YYYY-MM-DD> [reason]';

const TOOLS = [
  {
    name: 'get_fee_balance',
    description: "Get a student's outstanding fee balance and recent invoices.",
    input_schema: {
      type: 'object',
      properties: { studentName: { type: 'string', description: "The child's name, only needed if the sender has more than one linked child." } },
    },
  },
  {
    name: 'get_attendance',
    description: "Get a student's recent attendance records (present/absent/late/excused), optionally for one specific date.",
    input_schema: {
      type: 'object',
      properties: {
        studentName: { type: 'string', description: "The child's name, only needed if the sender has more than one linked child." },
        date: { type: 'string', description: 'An exact date in YYYY-MM-DD format. Omit to get recent history instead of one day.' },
      },
    },
  },
  {
    name: 'get_exam_results',
    description: "Get a student's exam results / report card. Only APPROVED marks are ever returned.",
    input_schema: {
      type: 'object',
      properties: {
        studentName: { type: 'string', description: "The child's name, only needed if the sender has more than one linked child." },
        examName: { type: 'string', description: 'Which exam, e.g. "Term 2 CAT 1". Omit to get the most recent exam.' },
      },
    },
  },
  {
    name: 'get_homework',
    description: "Get a student's upcoming homework assignments for their class.",
    input_schema: {
      type: 'object',
      properties: { studentName: { type: 'string', description: "The child's name, only needed if the sender has more than one linked child." } },
    },
  },
  {
    name: 'get_leave_requests',
    description: "Get the sender's own leave request history and status (staff only — there is no leave day 'balance' concept in this system, only request history).",
    input_schema: { type: 'object', properties: {} },
  },
] as const;

type ToolName = (typeof TOOLS)[number]['name'];

interface AnthropicContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  error?: { message?: string };
}

type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] | AnthropicToolResultBlock[] };

/**
 * Free-text WhatsApp questions are answered via Claude's tool-use API — Claude decides which of the
 * fixed read-only tools (WhatsAppAssistantToolsService) to call and with what arguments, but never
 * sees the database or gets to run arbitrary queries; this backend executes every tool call itself,
 * already scoped to the phone-resolved sender, and only feeds the JSON *result* back to Claude to
 * turn into a reply. Raw fetch() against the Messages API directly, matching every other external
 * integration in this codebase (no SDK dependency) — see WhatsAppCloudProvider/AdvantaSmsProvider for
 * the same convention.
 */
@Injectable()
export class WhatsAppClaudeProvider {
  private readonly logger = new Logger('WhatsAppAssistant');

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly tools: WhatsAppAssistantToolsService,
  ) {}

  async answer(user: JwtUserPayload, schoolName: string, question: string): Promise<string> {
    const settings = await this.platformSettings.get();
    const apiKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!settings.aiAssistantEnabled || !apiKey) return NOT_CONFIGURED_MESSAGE;

    const model = settings.anthropicModel || DEFAULT_MODEL;
    const systemPrompt =
      `You are a helpful assistant for ${schoolName}, answering ${user.fullName}'s question over WhatsApp. ` +
      'Only answer using the provided tools — never invent fee amounts, attendance, exam results, homework, or leave data. ' +
      'You may only ever see information about the sender\'s own linked children or their own records; you have no way to see any other family\'s data, so never claim otherwise. ' +
      "If a tool result contains an 'error' or asks for clarification (e.g. which child), relay that clearly and ask the follow-up question yourself. " +
      'If the question is unrelated to fees, attendance, exam results, homework, or leave requests, say so briefly and suggest the web portal or the school office. ' +
      'Keep replies short and WhatsApp-friendly (a few sentences, plain text, no markdown headers) and warm in tone.';

    const messages: AnthropicMessage[] = [{ role: 'user', content: question }];

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      let response: AnthropicResponse;
      try {
        const res = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
          body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system: systemPrompt, messages, tools: TOOLS }),
        });
        response = (await res.json()) as AnthropicResponse;
        if (!res.ok) {
          this.logger.error(`Anthropic API error: ${JSON.stringify(response)}`);
          return "Sorry, I couldn't process that right now. Please try again shortly.";
        }
      } catch (err) {
        this.logger.error(`Anthropic API call failed: ${err instanceof Error ? err.message : String(err)}`);
        return "Sorry, I couldn't process that right now. Please try again shortly.";
      }

      if (response.stop_reason !== 'tool_use') {
        return response.content
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text)
          .join('\n')
          .trim() || "I couldn't come up with an answer to that.";
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: AnthropicToolResultBlock[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use' || !block.id || !block.name) continue;
        const result = await this.runTool(user, block.name as ToolName, (block.input ?? {}) as Record<string, string>);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return "That's taking a bit too long to figure out — please try rephrasing your question, or use the web portal.";
  }

  private async runTool(user: JwtUserPayload, name: ToolName, args: Record<string, string>): Promise<unknown> {
    switch (name) {
      case 'get_fee_balance':
        return this.tools.getFeeBalance(user, { studentName: args.studentName });
      case 'get_attendance':
        return this.tools.getAttendance(user, { studentName: args.studentName, date: args.date });
      case 'get_exam_results':
        return this.tools.getExamResults(user, { studentName: args.studentName, examName: args.examName });
      case 'get_homework':
        return this.tools.getHomework(user, { studentName: args.studentName });
      case 'get_leave_requests':
        return this.tools.getLeaveRequests(user);
      default:
        return { error: 'Unknown tool' };
    }
  }
}
