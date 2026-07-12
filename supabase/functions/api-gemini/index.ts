// --- api-gemini/index.ts ---
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PayloadSchema = z.object({
  prompt: z.string().min(1).max(30000), // Increased to support full script context
  systemInstruction: z.string().max(10000).optional(),
  generationConfig: z.object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxOutputTokens: z.number().int().min(1).max(8192).optional(),
  }).optional(),
});

Deno.serve(async (req: Request) => {
  // 1. Handle CORS Preflight perfectly
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Strict Method Checking
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Auth Check (Assuming Supabase JWT)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized access", code: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await req.json();
    const parsed = PayloadSchema.safeParse(raw);
    
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload", details: parsed.error.issues, code: "BAD_REQUEST" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, systemInstruction, generationConfig } = parsed.data;
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI Engine not configured on server", code: "CONFIG_MISSING" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: {
        temperature: generationConfig?.temperature ?? 0.7, // Lowered slightly for better continuity
        topP: generationConfig?.topP ?? 0.9,
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 8192, // Maximized for full scripts
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      // Forward standard HTTP codes to the client so the Smart Client can queue/retry
      return new Response(JSON.stringify({ error: `AI Engine Error`, details: errText, code: "UPSTREAM_ERROR" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return new Response(JSON.stringify({ error: "AI returned empty content", code: "EMPTY_GENERATION" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standardized Success Response
    return new Response(JSON.stringify({ data: text, usage: data?.usageMetadata }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown Error", code: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
                                            
