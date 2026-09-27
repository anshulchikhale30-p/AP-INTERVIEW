export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Generic OpenAI-compatible LLM override (takes precedence over forge).
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "",
  // NVIDIA build API (nvapi-... key). Auto-detected when the key is present.
  nvidiaApiKey: process.env.NVIDIA_API_KEY ?? "",
  // AssemblyAI — powers the real-time voice agent via Universal-Streaming v3.
  assemblyAiKey: process.env.ASSEMBLYAI_API_KEY ?? "",
};

export const hasAssemblyAi = () => ENV.assemblyAiKey.trim().length > 0;
