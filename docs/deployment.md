# Deployment Guide

Neuron OS is optimized for deploy on Vercel with a Supabase back-end.

## Environment Variables

Configure these variables in your deployment control panel:

```env
# Next.js / Supabase Connections
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

## Deployment Steps

1. Create a Supabase project and execute the migrations found in `supabase/migrations/` in order.
2. Setup database storage bucket named `documents` and configure its policy to allow authenticated reads/writes.
3. Import the repository into Vercel.
4. Set the Environment Variables.
5. Deploy and verify the routes loading.
