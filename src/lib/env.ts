const requiredVars = [
  'VITE_API_URL',
] as const;

const optionalVars = [
  'VITE_MAPBOX_TOKEN',
  'VITE_USE_MOCK_API',
] as const;

export function validateEnv() {
  const isProduction = import.meta.env.PROD;
  const missing: string[] = [];

  for (const key of requiredVars) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message =
      `[MicroCrop] Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values.';

    console.error(message);
  }

  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    console.warn(
      '[MicroCrop] Running with mock API. Set VITE_API_URL to use a real backend.'
    );
  } else if (!import.meta.env.VITE_API_URL) {
    console.warn(
      '[MicroCrop] No VITE_API_URL configured. Falling back to mock API.'
    );
  }

  if (!import.meta.env.VITE_MAPBOX_TOKEN) {
    console.warn(
      '[MicroCrop] VITE_MAPBOX_TOKEN is not set. Map features will be disabled.'
    );
  }
}
