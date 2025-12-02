---
title: "Reverse Engineering Signin with Claude from Claude Code"
description: "A deep dive into Claude's OAuth implementation and how to integrate 'Sign in with Claude' into your applications"
date: 2025-12-02
tags: ["oauth", "claude", "authentication", "reverse-engineering"]
---

Imagine a world where you can just connect your claude account to any app you're using and inference is powered by your claude subscription.

this will enable a lot of small companies / makers to make ai apps without worrying about the cost,

1. They can save the user from the painful UX of creating api keys and giving it to the app
2. You don't to choose b/w inference costs and a good UX, you can have your cake and eat it. User's get a familiar signin flow, you get to not have the burden of inference costs. (ps: not recommended for people trying to sell sonnet for 50 cents on a dollar and claim bazillion USD ARR. )

ok, all fun and games, but signin with claude does not exist ? right ?

wrong, it does exists, and the answer is in claude code and how it implements the login with your pro/max account, and lucky for you, my dear brother in claude, i've done the work, and i will give you all the details on how to get it working, so you can use sign in with claude in your apps.

There's no rocket science, the flow is the usual Auth Code + PKCE Oauth flow that most apps use these days, with a bit of a twist, Here are the params that you need to know.

```json
{
  "authorization_endpoint": "https://claude.ai/oauth/authorize",
  "token_endpoint": "https://console.anthropic.com/v1/oauth/token",
  "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  "redirect_uri": "https://console.anthropic.com/oauth/code/callback",
  "response_type": "code",
  "code_challenge_method": "S256",
  "scopes": ["user:profile", "user:inference"]
}
```

Ok, but what are all these values ? Hmm, A full blown oauth flows tutorial is out of the scope of this thread, ask claude/chatgpt to clear your doubts, but i'll give you a very brief explanation on AuthCode Oauth flow.

#### 1. Authorization Code Flow

**What OAuth enables:** OAuth Let users grant your app access to their account (e.g., Claude) without sharing their password. User authenticates directly with Claude → your app gets tokens → you call APIs on their behalf.

OAuth has multiple flows. **Authorization Code** is the most secure—it retrieves access tokens (and optionally refresh tokens) without exposing them in the browser URL.

Traditional auth code flow uses `client_id` + `client_secret`. But we don't have a client_secret here. That's because Claude Code is a "public client" (CLI tools, mobile apps, SPAs can't securely store secrets). Instead, we use **PKCE** (next section) to replace the client_secret.

**Core parameters:**

- `client_id` — identifies your app
- `redirect_uri` — where to send user after auth
- `response_type=code` — "give me an auth code, not a token directly"
- `scope` — permissions you're requesting
- `state` — **cryptographically random** string for CSRF protection. Must be unpredictable (not `test123`). Format: base64url, 43 chars. Generate with `crypto.randomBytes(32).toString('base64url')` in Node.js. Validate on callback—reject if it doesn't match.

**The exchange:** Auth code is short-lived (~5 min). You POST it to the token endpoint → get back long-lived `access_token` + `refresh_token`. These are what you use with Claude's API.

#### 2. Authorization Code + PKCE

**PKCE** (Proof Key for Code Exchange) adds a security layer for public clients that can't use client_secret.

**Extra parameters:**

- `code_verifier` — random string (43-128 chars) you generate. **Kept secret, NEVER sent until token exchange**
- `code_challenge` — SHA256 hash of the verifier, sent in auth URL
- `code_challenge_method=S256` — tells server you used SHA256

**Attack vectors mitigated:**

- **Authorization Code Interception** — attacker grabs code from callback URL (via malicious app, logs, browser history)
- **Code Injection** — attacker injects a stolen code into a legitimate client

With PKCE, code is useless without the original `code_verifier` (only your app has it).

```
┌─────────────┐                                                                                    ┌─────────────┐
│   Your App  │                                                                                    │  claude.ai  │
└──────┬──────┘                                                                                    └──────┬──────┘
       │                                                                                                  │
       │  1. Generate code_verifier (secret)                                                              │
       │     Calculate code_challenge = SHA256(verifier)                                                  │
       │                                                                                                  │
       │  2. Auth request + code_challenge sent to claude ───────────────────────────────────────────────►│
       │                                                                                                  │
       │  3. User logs in to their claude account, approves the requested scopes                          │
       │                                                                                                  │
       │  4. Claude gives you an Auth code that you can exchange for the actual access tokens ◄───────────│
       │     (short-lived, ~5 min)                                                                        │
       │                                                                                                  │
       │  5. You send the token request, along with your code_verifier ──────────────────────────────────►│
       │     (verifier sent for FIRST time)                                                               │
       │                                                                                                  │
       │  6. Server checks: SHA256(verifier) == challenge?                                                │
       │                                                                                                  │
       │  7. You are given back as response access_token + refresh_token ◄────────────────────────────────│
       │                                                                                                  │
```

Now let's get back to our example. Copy and paste the below URL into your browser:

> **Note:** Don't worry—this URL is safe. It points to `claude.ai` and redirects to `console.anthropic.com`. Everything stays within Claude's ecosystem.

> **Important:** This is a complete working example with pre-generated values. The `state`, `code_challenge`, and `code_verifier` (shown later) work together as a set. For your own implementation, you MUST generate fresh random values for each authorization flow.

```
https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback&scope=user%3Aprofile+user%3Ainference&code_challenge=tVMQFcwjTUOtHRtenoyryOFO7RNuvZcrckwonpFEHMA&code_challenge_method=S256&state=FnYjhTFqgrmuvpM7c1voDJzGlurOUsDGRc58hk3YHbg
```

After you authenticate, you'll land on Claude's hosted success page with your auth code displayed. Copy it, this short-lived code (~5 min) is what you'll exchange for long-lived tokens.

### Understanding the Callback Code Format

**Important**: The authorization code you receive has the format `{authorization_code}#{state}`. For example:

```
vaFUyb1RNT0AsOXJs6qYmG9Iaa7Uy1uXOsmDS7YyFKwuTS3O#FnYjhTFqgrmuvpM7c1voDJzGlurOUsDGRc58hk3YHbg
```

You need to split this on the `#` character before making the token request:

- **First part (before #)**: The authorization code to exchange for tokens
- **Second part (after #)**: The state value (must match what you sent in the authorization URL for CSRF protection)

Now let's exchange this code for tokens. Replace the placeholders in the curl request below:

```bash
curl -X POST "https://console.anthropic.com/v1/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "<PASTE_CODE_BEFORE_#>",
    "state": "<PASTE_STATE_AFTER_#>",
    "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    "redirect_uri": "https://console.anthropic.com/oauth/code/callback",
    "code_verifier": "UwFzyWG95xbpVd0Vh-kI8ieijLmaTv80VAsZ7jxg3XM"
  }'
```

### Understanding state vs code_verifier

`state` and `code_verifier` are **TWO DIFFERENT** random values that serve different security purposes:

- **`state`** (CSRF Protection): Prevents attackers from injecting malicious authorization codes into your callback. The state value is:

  - Sent in the authorization URL
  - Returned in the callback (after the `#`)
  - Validated to match what you originally sent
  - Protects against cross-site request forgery attacks

- **`code_verifier`** (PKCE Protection): Prevents authorization code interception attacks. The verifier:
  - Is kept secret on your client (NEVER sent during authorization)
  - Only its SHA256 hash (`code_challenge`) is sent in the authorization URL
  - Is sent during token exchange to prove you're the original requester
  - Protects against code stealing via URL interception

**The relationship:**

```
code_challenge = base64url(sha256(code_verifier))
```

When the server receives your token exchange request, it:

1. Validates that `state` matches the state from the authorization request
2. Calculates `sha256(code_verifier)` and verifies it matches the `code_challenge` from authorization
3. Only then issues tokens

> **Important Security Note:**
>
> - Generate TWO separate random values: one for `state`, one for `code_verifier`
> - Both should be cryptographically random: `crypto.randomBytes(32).toString('base64url')`
> - Never reuse values across different authorization flows
> - The example values in this doc are for demonstration - they ONLY work together as a set

### Successful Token Response

When the token exchange succeeds, you'll receive a response like this:

```json
{
  "token_type": "Bearer",
  "access_token": "sk-ant-oat01-xxxx...xxxx",
  "expires_in": 28800,
  "refresh_token": "sk-ant-ort01-xxxx...xxxx",
  "scope": "user:inference user:profile",
  "organization": {
    "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "your-email@example.com's Organization"
  },
  "account": {
    "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email_address": "your-email@example.com"
  }
}
```

**Key fields:**

- `access_token` — Use this in API requests (`Authorization: Bearer sk-ant-oat01-...`)
- `expires_in` — Token validity in seconds (28800 = 8 hours)
- `refresh_token` — Use this to get new access tokens when they expire
- `scope` — Confirms which permissions were granted

### Refreshing Tokens

Access tokens expire after 8 hours. Use the refresh token to get a new access token without requiring the user to re-authenticate:

```bash
curl -X POST "https://console.anthropic.com/v1/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "<YOUR_REFRESH_TOKEN>",
    "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
  }'
```

**Important:** Claude uses **refresh token rotation** — each refresh returns a NEW refresh token and invalidates the old one. Always store the latest refresh token from each response.

### Using the Token with Claude API

Ok, now you've got the token, are we done ? nope, we need to do a bit more plumbing to get things to work compared to how you'd normally use the api.

**You need to add these extra headers:**

- `Authorization: Bearer <YOUR_ACCESS_TOKEN>`
- `anthropic-beta: oauth-2025-04-20,claude-code-20250219`

**Add the claude code system prompt:**

The API validates that you're using it as Claude Code. Your system prompt **must** start with:

```
You are Claude Code, Anthropic's official CLI for Claude.
```

You can append your own instructions after this prefix:

```
You are Claude Code, Anthropic's official CLI for Claude. You are also a helpful coding assistant specialized in React and TypeScript.
```

**Complete curl example:**

```bash
curl -X POST "https://api.anthropic.com/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: oauth-2025-04-20,claude-code-20250219" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "system": "You are Claude Code, Anthropic'\''s official CLI for Claude.",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Note:** The system message can also be added in the messages array if preferred.

**TypeScript SDK example:**

```typescript
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic({
  authToken: "<YOUR_ACCESS_TOKEN>", // Use authToken, not apiKey
});

const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  system: "You are Claude Code, Anthropic's official CLI for Claude.",
  messages: [{ role: "user", content: "Hello" }],
  betas: ["oauth-2025-04-20", "claude-code-20250219"],
});
```

Awesome. now you know how to generate the tokens for a pro/max user, and how to use it in your api requests to claude code.

Now What's remaining ? It'd be nice if we could avoid the copy + paste part of the auth code right ? there's a way and i'll post it tomorrow.
