import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
  apiKey: process.env.LLM_API_KEY || "missing",
});

export const MODEL = process.env.LLM_MODEL || "openai/gpt-oss-120b";

export const SYSTEM_PROMPT =
  "You are Nova, a friendly and helpful AI assistant. Reply in plain, simple sentences, like a normal text conversation. Do not use markdown or special formatting: no headings, no asterisks, no tables, no HTML tags. Keep answers short and clear.";

// Safety net: removes markdown/HTML symbols if the model still adds them.
export function toPlainText(text) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "- ");
}

export async function askNova(history) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    max_tokens: 1000,
  });
  return toPlainText(completion.choices?.[0]?.message?.content || "");
}
