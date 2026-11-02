# Nova chatbot (v2: login + saved chats)

Next.js chatbot with sign up / log in, a ChatGPT-style sidebar of saved chats, a free LLM API (Groq by default) and a free Neon Postgres database. Deploys free on Vercel.

## Environment variables (set in Vercel -> Project Settings -> Environment Variables)
| Name | Value |
|------|-------|
| `LLM_API_KEY` | your Groq API key |
| `AUTH_SECRET` | any random text, 32+ characters (signs login cookies; keep it private) |
| `DATABASE_URL` | added automatically when you connect Neon in Vercel -> Storage |

Optional: `LLM_BASE_URL` and `LLM_MODEL` to switch provider/model (any OpenAI-compatible API).

## Database setup
Connect a Neon Postgres database from the Vercel Storage tab. Tables are created automatically on first use, so there is no SQL to run.

## Run locally (optional)
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values
3. `npm run dev`
