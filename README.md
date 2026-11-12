# Nova chatbot (security-reviewed - email OTP, forgot / change password, account settings, saved chats, pin / rename / delete, search)

Next.js chatbot with sign up / log in, a ChatGPT-style sidebar of saved chats, a free LLM API (Groq by default) and a free Neon Postgres database. Deploys free on Vercel.

## Environment variables (set in Vercel -> Project Settings -> Environment Variables)
| Name | Value |
|------|-------|
| `LLM_API_KEY` | your Groq API key |
| `AUTH_SECRET` | any random text, 32+ characters (signs login cookies; keep it private) |
| `SMTP_USER` | Gmail address that sends the verification emails |
| `SMTP_PASS` | Gmail App Password (16 characters; needs 2-Step Verification) |
| `DATABASE_URL` | added automatically when you connect Neon in Vercel -> Storage |

Optional: `LLM_BASE_URL` and `LLM_MODEL` to switch provider/model (any OpenAI-compatible API).

## Database setup
Connect a Neon Postgres database from the Vercel Storage tab. Tables are created automatically on first use, so there is no SQL to run.

## Security summary
- API key, database address and secrets are read only on the server (environment variables); nothing secret reaches the browser.
- Passwords are stored as bcrypt hashes; email codes are stored only as keyed hashes (6 digits, 10 minutes, 5 tries).
- Login uses a signed JWT in an HttpOnly, Secure, SameSite=Lax cookie; logging out cancels older tokens.
- Every database query is parameterized and scoped to the logged-in user.
- Rate limits are stored in the database, so they hold across all serverless instances.
- Cross-site write requests are blocked (middleware.js) and security headers are set (next.config.mjs).

