// --- src/lib/geminiClient.ts ---
import { useAiCacheStore, useToastStore } from './stores';
import { supabase } from './supabase'; // Adjust import based on your setup

interface GenerateParams {
  prompt: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
}

// Simple hash to uniquely identify requests
const generateHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
};

export const generateAIContent = async ({ prompt, systemInstruction, maxOutputTokens = 8192 }: GenerateParams): Promise<string> => {
  const hash = generateHash(prompt + (systemInstruction || ''));
  const cacheStore = useAiCacheStore.getState();
  const toastStore = useToastStore.getState();

  // 1. CACHE CHECK: Prevent duplicate requests
  if (cacheStore.hasCache(hash)) {
    return cacheStore.cache[hash];
  }

  // 2. QUEUE CHECK: Prevent React double-firing
  if (cacheStore.isRequesting(hash)) {
    throw new Error("Generation already in progress");
  }

  cacheStore.addRequest(hash);

  try {
    // 3. SECURE BACKEND CALL: Invoking Supabase Edge Function
    // Ab hum frontend mein key nahi dhoondh rahe hain!
    const { data, error } = await supabase.functions.invoke('api-gemini', {
      body: { 
        prompt, 
        systemInstruction, 
        maxOutputTokens 
      }
    });

    if (error) {
      console.error("Supabase Edge Function Error:", error);
      throw new Error("Backend AI Generation Failed");
    }

    // Edge function se aaya hua text extract karein
    // (Aapke edge function ke response structure ke hisaab se ise adjust karein, 
    // commonly ye data.text ya data.result hota hai)
    const resultText = data?.text || data?.result || "";

    if (!resultText) {
      throw new Error("Empty response received from backend");
    }

    // 4. Save to cache and return
    cacheStore.setCache(hash, resultText);
    return resultText;

  } catch (error: any) {
    toastStore.addToast(error.message || "Failed to generate script", "error");
    throw error;
  } finally {
    cacheStore.removeRequest(hash);
  }
};
   // 1. CACHE CHECK: Prevent duplicate requests completely
  if (cacheStore.hasCache(hash)) {
    return cacheStore.cache[hash];
  }

  // 2. QUEUE CHECK: Prevent React double-firing
  if (cacheStore.isRequesting(hash)) {
    throw new Error("Generation already in progress");
  }

  cacheStore.addRequest(hash);

  const maxRetries = 3;
  let attempt = 0;
  const baseDelay = 1000;

  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gemini`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            prompt,
            systemInstruction,
            generationConfig: { maxOutputTokens }
          })
        });

        if (response.ok) {
          const result = await response.json();
          cacheStore.setCache(hash, result.data); // Save to cache
          return result.data;
        }

        // 3. SMART ERROR HANDLING
        const errorData = await response.json().catch(() => ({}));
        
        // Never retry client errors (400, 401, 403, 429)
        if (response.status >= 400 && response.status < 500) {
          if (response.status === 429) {
             throw new Error("AI Quota Exceeded. Please try again later.");
          }
          throw new Error(errorData.error || `Client Error: ${response.status}`);
        }

        // Retry on 500, 502, 503, 504
        throw new Error(errorData.error || `Server Error: ${response.status}`);

      } catch (err: any) {
        attempt++;
        const isRetryable = err.message.includes("Server Error") || err.message.includes("fetch");
        
        if (!isRetryable || attempt >= maxRetries) {
          throw err;
        }
        
        // Exponential Backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        toastStore.addToast(`AI Engine busy, retrying in ${delay/1000}s...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  } finally {
    cacheStore.removeRequest(hash); // Unlock the queue
  }
};

