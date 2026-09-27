import { z } from "zod";
import { ENV, hasAssemblyAi } from "./env";

const TOKEN_ENDPOINT = "https://streaming.assemblyai.com/v3/token";

/**
 * Mint a short-lived AssemblyAI streaming token.
 *
 * The browser must never see the account API key, so the client authenticates
 * to AssemblyAI with a single-use temporary token minted here. Each token is
 * valid for one session, which is exactly the lifetime we want: one interview
 * turn stream, then it is gone.
 */
export async function createStreamingToken(
  options: { maxSessionDurationSeconds?: number } = {}
): Promise<{ token: string; expiresInSeconds: number }> {
  const key = ENV.assemblyAiKey.trim();
  if (!key) {
    throw new Error(
      "ASSEMBLYAI_API_KEY is not configured. Real-time voice is disabled."
    );
  }

  const params = new URLSearchParams({
    expires_in_seconds: "60",
    // Cap the session so a stuck or abandoned tab cannot burn credits.
    max_session_duration_seconds: String(
      Math.min(
        10_800,
        Math.max(60, options.maxSessionDurationSeconds ?? 600)
      )
    ),
  });

  const response = await fetch(`${TOKEN_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: { authorization: key },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `AssemblyAI token request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("AssemblyAI did not return a streaming token.");
  }

  return { token: data.token, expiresInSeconds: 60 };
}

export const streamingConfigSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().optional(),
});

/**
 * Tell the client which streaming parameters to open the socket with. Keeps the
 * endpoint and sample rate in one place so the client never hardcodes them.
 */
export function getStreamingConfig() {
  return {
    enabled: hasAssemblyAi(),
    endpoint: "wss://streaming.assemblyai.com/v3/ws",
    sampleRate: 16_000,
    speechModel: "universal-3-6-pro",
  };
}
