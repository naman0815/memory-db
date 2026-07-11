# Brain 2

A fully free, installable PWA that stores whatever you tell it to remember and
answers natural-language questions about it — with all AI running in your
browser. No server compute, no API keys, no bills.

## How it works

- **Home**: one composer for everything. Type or dictate — a plain statement
  ("my locker code is 4421") saves as a memory; a question ("what's my locker
  code?") searches instead, detected automatically from the text (the button
  shows "Save" or "Ask" so you can see the guess before committing). Saved
  instantly to IndexedDB and embedded locally with `all-MiniLM-L6-v2`
  (transformers.js, ~25MB, WASM). Questions are matched against stored
  memories by cosine similarity; a confident single match answers directly
  from that memory (no model involved), otherwise an optional local LLM
  (Qwen2.5-0.5B via WebLLM) synthesizes an answer grounded strictly in your
  memories.
- **Brain**: browse everything — categories, tags, type filters, full
  timeline.
- **Settings**: your name, Face ID lock, photo auto-captioning, smart-answer
  opt-in, and backup.
- **Backup** (optional, in Settings): sign in with a magic link and every
  memory backs up to your own free Supabase project. Local-first — the cloud
  is never on the read path. Restore pulls the raw text back and re-embeds
  locally.

## Development

```sh
npm install
npm run dev
```

## Supabase backup setup (optional, free)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Run `supabase/schema.sql` in the SQL Editor (creates the table + RLS).
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key
   from Project Settings → API.

## Deploying (free)

Any static host over HTTPS works. E.g. Cloudflare Pages / Netlify / GitHub
Pages: build command `npm run build`, output directory `dist`. Set the two
`VITE_SUPABASE_*` env vars in the host's dashboard if using backup.

On iPhone/iPad: open the deployed URL in Safari → Share → Add to Home Screen.

## Browser support

| Feature | Requirement |
|---|---|
| Capture + semantic search | Any modern browser (WASM) |
| Smart answers (local LLM) | WebGPU — Safari 26+, Chrome, Edge |
| Voice input | Safari / Chrome (Web Speech API) |
