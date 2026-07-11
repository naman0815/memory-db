# Memory DB

A fully free, installable PWA that stores whatever you tell it to remember and
answers natural-language questions about it — with all AI running in your
browser. No server compute, no API keys, no bills.

## How it works

- **Remember**: type or dictate a fact. It's saved instantly to IndexedDB and
  embedded locally with `all-MiniLM-L6-v2` (transformers.js, ~25MB, WASM).
- **Ask**: your question is embedded and matched against stored memories by
  cosine similarity. If smart answers are enabled (WebGPU + one-time ~1GB
  download of Qwen2.5-1.5B via WebLLM), a grounded natural-language answer is
  generated on-device; otherwise the best-matching memories are shown directly.
- **Backup** (optional): sign in with a magic link and every memory backs up to
  your own free Supabase project. Local-first — the cloud is never on the read
  path. Restore pulls the raw text back and re-embeds locally.

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
