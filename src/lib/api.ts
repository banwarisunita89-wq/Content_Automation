import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import { useToastStore } from './stores';

const MAX_RETRIES = 0;
const BASE_DELAY = 1000;

type RetryConfig = {
  _retryCount?: number;
  _provider?: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const EDGE_URLS = {
  gemini: `${SUPABASE_URL}/functions/v1/api-gemini`,
  video: `${SUPABASE_URL}/functions/v1/api-video`,
  audio: `${SUPABASE_URL}/functions/v1/api-audio`,
};

const apiClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON_KEY}`,
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError & RetryConfig) => {
    const config = error.config as AxiosRequestConfig & RetryConfig;
    if (!config) {
      useToastStore.getState().addToast('Service Timeout', 'error');
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const isRetryable = status === 429 || status === 503 || status === 500 || error.code === 'ECONNABORTED' || !error.response;

    if (status === 401 || status === 403) {
      useToastStore.getState().addToast('Access Denied — Authentication Required', 'error');
      return Promise.reject(error);
    }

    if (!isRetryable || (config._retryCount ?? 0) >= MAX_RETRIES) {
      const provider = config._provider || 'Service';
      const msg = status ? `${provider} request failed (${status})` : `${provider} request failed — network error`;
      useToastStore.getState().addToast(msg, 'error');
      return Promise.reject(error);
    }

    const retryCount = (config._retryCount ?? 0) + 1;
    const delay = BASE_DELAY * Math.pow(2, retryCount - 1);
    const provider = config._provider || 'Service';

    useToastStore.getState().addToast(
      `${provider} retrying — attempt ${retryCount + 1}/${MAX_RETRIES + 1} in ${delay / 1000}s`,
      'warning',
      retryCount + 1
    );

    config._retryCount = retryCount;
    await new Promise((r) => setTimeout(r, delay));
    return apiClient(config);
  }
);

export async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const response = await apiClient.post(
      EDGE_URLS.gemini,
      { prompt, systemInstruction },
      { _provider: 'Gemini' } as unknown as AxiosRequestConfig
    );
    const text = response.data?.text;
    if (!text) throw new Error('Gemini returned no content');
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Provider Timeout';
    throw new Error(msg);
  }
}

export async function callFal(modelId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const response = await apiClient.post(
      EDGE_URLS.video,
      { modelId, input },
      { _provider: 'Fal' } as unknown as AxiosRequestConfig
    );
    return response.data as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Provider Timeout';
    throw new Error(msg);
  }
}

export async function callElevenLabs(text: string, voiceId: string): Promise<Record<string, unknown>> {
  try {
    const response = await apiClient.post(
      EDGE_URLS.audio,
      { action: 'tts', text, voiceId },
      { _provider: 'ElevenLabs' } as unknown as AxiosRequestConfig
    );
    return response.data as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Provider Timeout';
    throw new Error(msg);
  }
}

export async function callHuggingFace(endpoint: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const response = await apiClient.post(
      EDGE_URLS.audio,
      { action: 'sfx', modelEndpoint: endpoint, input },
      { _provider: 'HuggingFace' } as unknown as AxiosRequestConfig
    );
    return response.data as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Provider Timeout';
    throw new Error(msg);
  }
}

export { apiClient };
