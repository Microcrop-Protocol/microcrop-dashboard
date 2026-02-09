import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { validateEnv } from '@/lib/env';

describe('validateEnv', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset env
    Object.keys(import.meta.env).forEach(key => {
      if (key.startsWith('VITE_')) {
        delete (import.meta.env as Record<string, string>)[key];
      }
    });
    (import.meta.env as Record<string, unknown>).PROD = false;
    (import.meta.env as Record<string, unknown>).DEV = true;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    // Restore original env
    Object.assign(import.meta.env, originalEnv);
  });

  it('logs error when required vars are missing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => validateEnv()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Missing required environment variables')
    );
  });

  it('does not throw in production when required vars are missing', () => {
    (import.meta.env as Record<string, unknown>).PROD = true;
    (import.meta.env as Record<string, unknown>).DEV = false;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => validateEnv()).not.toThrow();
  });

  it('does not throw when all required vars are present', () => {
    (import.meta.env as Record<string, string>).VITE_API_URL = 'http://localhost:3000';
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => validateEnv()).not.toThrow();
  });

  it('warns when VITE_USE_MOCK_API is true', () => {
    (import.meta.env as Record<string, string>).VITE_API_URL = 'http://localhost:3000';
    (import.meta.env as Record<string, string>).VITE_USE_MOCK_API = 'true';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateEnv();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Running with mock API')
    );
  });

  it('warns when no API URL is configured', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    validateEnv();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to mock API')
    );
  });

  it('warns when VITE_MAPBOX_TOKEN is not set', () => {
    (import.meta.env as Record<string, string>).VITE_API_URL = 'http://localhost:3000';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateEnv();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('VITE_MAPBOX_TOKEN is not set')
    );
  });

  it('does not warn about mapbox when token is set', () => {
    (import.meta.env as Record<string, string>).VITE_API_URL = 'http://localhost:3000';
    (import.meta.env as Record<string, string>).VITE_MAPBOX_TOKEN = 'pk.test123';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateEnv();
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('VITE_MAPBOX_TOKEN')
    );
  });
});
