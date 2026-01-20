import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const MAX_CHARS = 30000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SYSTEM_PROMPT = `You are DocMind, an AI assistant that answers questions strictly using the provided document text. Do not use outside knowledge.

When answering:
1. Provide a clear, direct answer
2. Include 1-5 citations from the document that support your answer
3. Copy citation text EXACTLY as it appears - do not paraphrase, summarize, or clean up
4. Include original punctuation, capitalization, and spacing in citations
5. Keep citations between 50-200 characters for optimal highlighting
6. If you cannot find an exact quote, omit the citation entirely
7. Never merge multiple sentences into one citation
8. If the answer cannot be found, respond with no citations

Return JSON:
{
  "answer": "Your answer here",
  "citations": [
    { "id": "cite-1", "text": "exact quote from document", "relevance": "Why this matters" }
  ]
}`;

const allowedModes = new Set([
  "qa",
  "summary",
  "eli5",
  "key-takeaways",
  "main-arguments",
]);

interface QueryRequest {
  pageText: string;
  question?: string;
  mode?: string;
  url?: string;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not configured");
    return NextResponse.json(
      { error: "API_ERROR", message: "Server configuration error" },
      { status: 500, headers: corsHeaders }
    );
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const body: QueryRequest = await req.json();
    console.log("=== DEBUG ===");
    console.log("Body keys:", Object.keys(body));
    console.log("pageText exists:", !!body.pageText);
    console.log("pageText length:", body.pageText?.length);
    console.log("=============");
    const { pageText, question, url } = body;

    if (!pageText || pageText.length < 100) {
      return NextResponse.json(
        { error: "INSUFFICIENT_TEXT" },
        { status: 400, headers: corsHeaders }
      );
    }

    const safeText =
      pageText.length > MAX_CHARS ? pageText.slice(0, MAX_CHARS) : pageText;

    const rawMode = body.mode ?? "qa";
    const mode = allowedModes.has(rawMode) ? rawMode : "qa";

    if (mode === "qa" && (!question || !question.trim())) {
      return NextResponse.json(
        { error: "MISSING_QUESTION" },
        { status: 400, headers: corsHeaders }
      );
    }

    const userPrompt = buildPrompt(safeText, question, mode, url);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "UNEXPECTED_RESPONSE" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ raw: textBlock.text }, { headers: corsHeaders });
  } catch (err) {
    console.error("API error:", err);

    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        return NextResponse.json(
          { error: "RATE_LIMITED" },
          { status: 429, headers: corsHeaders }
        );
      }

      return NextResponse.json(
        { error: "API_ERROR", message: err.message },
        { status: err.status || 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: "API_ERROR" },
      { status: 500, headers: corsHeaders }
    );
  }
}

function buildPrompt(
  text: string,
  question: string | undefined,
  mode: string,
  url?: string
): string {
  const docBlock = `<document>\n${text}\n</document>`;
  const jsonReminder =
    "\n\nReturn your response as JSON with answer and citations array.";

  switch (mode) {
    case "summary":
      return `${docBlock}\n\nProvide a concise summary of this document in 3-5 paragraphs.${jsonReminder}`;
    case "key-takeaways":
      return `${docBlock}\n\nList the 5-7 key takeaways from this document.${jsonReminder}`;
    case "eli5":
      return `${docBlock}\n\nExplain this document in simple terms that a 5-year-old could understand.${jsonReminder}`;
    case "main-arguments":
      return `${docBlock}\n\nIdentify and list the main arguments or claims made in this document.${jsonReminder}`;
    default:
      return `${docBlock}\n\nQuestion: ${question}${jsonReminder}`;
  }
}
