import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const MAX_CHARS = 30000;

const SYSTEM_PROMPT = `You are DocMind, an AI assistant that answers questions strictly using the provided document text. Do not use outside knowledge.

Rules:
- Only use information from the provided document
- If the answer cannot be found in the document, you MUST respond exactly: "The answer does not appear in the provided document."
- When possible, quote or reference specific passages from the document
- Be concise and direct`;

const allowedActions = new Set([
  'ask',
  'summarize',
  'takeaways',
  'eli5',
  'arguments',
] as const);

interface QueryRequest {
  text: string;
  question?: string;
  action?: string;
}

export async function POST(req: NextRequest) {
  // Guard: API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return NextResponse.json(
      { error: 'API_ERROR', message: 'Server configuration error' },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const body: QueryRequest = await req.json();
    const { text, question } = body;

    // Validation
    if (!text || text.length < 100) {
      return NextResponse.json({ error: 'INSUFFICIENT_TEXT' }, { status: 400 });
    }

    // Server-side truncation (defense in depth)
    const safeText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

    // Validate action
    const rawAction = body.action ?? 'ask';
    const action = allowedActions.has(rawAction as any) ? rawAction : 'ask';

    // Validate question when action is 'ask'
    if (action === 'ask' && (!question || !question.trim())) {
      return NextResponse.json(
        { error: 'INSUFFICIENT_TEXT', message: 'Question is required' },
        { status: 400 }
      );
    }

    // Build user prompt
    const userPrompt = buildPrompt(safeText, question, action);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Defensive response handling
    const textBlock = response.content.find((block) => block.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'UNEXPECTED_RESPONSE' }, { status: 500 });
    }

    return NextResponse.json({ answer: textBlock.text });
  } catch (err) {
    console.error('API error:', err);

    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
      }

      return NextResponse.json(
        { error: 'API_ERROR', message: err.message },
        { status: err.status || 500 }
      );
    }

    return NextResponse.json({ error: 'API_ERROR' }, { status: 500 });
  }
}

function buildPrompt(
  text: string,
  question: string | undefined,
  action: string
): string {
  const docBlock = `<document>\n${text}\n</document>`;

  switch (action) {
    case 'summarize':
      return `${docBlock}\n\nProvide a concise summary of this document in 3-5 paragraphs.`;
    case 'takeaways':
      return `${docBlock}\n\nList the 5-7 key takeaways from this document as bullet points.`;
    case 'eli5':
      return `${docBlock}\n\nExplain this document in simple terms that a 5-year-old could understand.`;
    case 'arguments':
      return `${docBlock}\n\nIdentify and list the main arguments or claims made in this document.`;
    default:
      return `${docBlock}\n\nQuestion: ${question}`;
  }
}
