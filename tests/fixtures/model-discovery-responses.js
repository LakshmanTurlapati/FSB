'use strict';

/**
 * Captured/synthetic response fixtures for the 5 supported model-discovery providers.
 * Each fixture contains AT LEAST one model that should be filtered out (embedding /
 * audio / image-gen / vision-only) and AT LEAST 2 models that should be kept, so that
 * filter coverage is exercisable from unit tests.
 *
 * Sources: hand-written from documented response shapes in
 * .planning/phases/228-dynamic-model-discovery/228-CONTEXT.md and the public provider
 * docs (xAI, OpenAI, Anthropic, Gemini, OpenRouter). NO real network calls were made
 * to produce these fixtures.
 */

const RESPONSE_FIXTURES = {
  // xAI: GET https://api.x.ai/v1/models -> OpenAI-shaped { data: [{ id, ... }] }
  xai: {
    object: 'list',
    data: [
      { id: 'grok-4-1-fast', object: 'model', created: 1733000000, owned_by: 'xai' }, // keep
      { id: 'grok-4', object: 'model', created: 1732000000, owned_by: 'xai' }, // keep
      { id: 'grok-code-fast-1', object: 'model', created: 1731000000, owned_by: 'xai' }, // keep
      // Filter target: name contains "image" — drop per xAI filter rule
      { id: 'grok-2-image-1212', object: 'model', created: 1730000000, owned_by: 'xai' },
      // Filter target: not a grok-* id at all — drop per xAI filter rule (id prefix)
      { id: 'unrelated-test-model', object: 'model', created: 1729000000, owned_by: 'xai' }
    ]
  },

  // OpenAI: GET https://api.openai.com/v1/models -> { data: [{ id, ... }] }
  openai: {
    object: 'list',
    data: [
      { id: 'gpt-4o', object: 'model', created: 1710000000, owned_by: 'openai' }, // keep
      { id: 'gpt-4o-mini', object: 'model', created: 1711000000, owned_by: 'openai' }, // keep
      { id: 'o1-preview', object: 'model', created: 1720000000, owned_by: 'openai' }, // keep
      { id: 'chatgpt-4o-latest', object: 'model', created: 1715000000, owned_by: 'openai' }, // keep
      // Drops:
      { id: 'text-embedding-3-large', object: 'model', created: 1700000000, owned_by: 'openai' },
      { id: 'whisper-1', object: 'model', created: 1690000000, owned_by: 'openai' },
      { id: 'dall-e-3', object: 'model', created: 1695000000, owned_by: 'openai' },
      { id: 'tts-1', object: 'model', created: 1690000000, owned_by: 'openai' },
      { id: 'gpt-4o-audio-preview', object: 'model', created: 1716000000, owned_by: 'openai' },
      { id: 'gpt-4o-realtime-preview', object: 'model', created: 1717000000, owned_by: 'openai' }
    ]
  },

  // Anthropic: GET https://api.anthropic.com/v1/models
  // -> { data: [{ id, display_name, created_at, type }], has_more, first_id, last_id }
  anthropic: {
    data: [
      // Older first to verify the provider's sort-newest-first behavior:
      {
        type: 'model',
        id: 'claude-haiku-3-5-20241022',
        display_name: 'Claude Haiku 3.5',
        created_at: '2024-10-22T00:00:00Z'
      },
      {
        type: 'model',
        id: 'claude-opus-4-1-20250805',
        display_name: 'Claude Opus 4.1',
        created_at: '2025-08-05T00:00:00Z'
      },
      {
        type: 'model',
        id: 'claude-sonnet-4-5-20250929',
        display_name: 'Claude Sonnet 4.5',
        created_at: '2025-09-29T00:00:00Z'
      },
      // Filter target: id does not start with "claude-" — drop
      {
        type: 'model',
        id: 'legacy-experimental-model',
        display_name: 'Legacy Experimental',
        created_at: '2023-01-01T00:00:00Z'
      }
    ],
    has_more: false
  },

  // Gemini: GET https://generativelanguage.googleapis.com/v1beta/models?key=...
  // -> { models: [{ name, displayName, supportedGenerationMethods, ... }] }
  gemini: {
    models: [
      {
        name: 'models/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        supportedGenerationMethods: ['generateContent', 'countTokens'],
        inputTokenLimit: 1048576
      },
      {
        name: 'models/gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash Experimental',
        supportedGenerationMethods: ['generateContent', 'countTokens'],
        inputTokenLimit: 1048576
      },
      // Filter target: only embedContent — drop
      {
        name: 'models/text-embedding-004',
        displayName: 'Text Embedding 004',
        supportedGenerationMethods: ['embedContent'],
        inputTokenLimit: 2048
      },
      // Filter target: imagen — drop even though it supports generateContent
      {
        name: 'models/imagen-3.0-generate',
        displayName: 'Imagen 3.0 Generate',
        supportedGenerationMethods: ['generateContent'],
        inputTokenLimit: 0
      }
    ]
  },

  // OpenRouter: GET https://openrouter.ai/api/v1/models
  // -> { data: [{ id, name, context_length, ... }] }
  openrouter: {
    data: [
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI: GPT-4o',
        context_length: 128000
      },
      {
        id: 'anthropic/claude-sonnet-4',
        name: 'Anthropic: Claude Sonnet 4',
        context_length: 200000
      },
      {
        id: 'x-ai/grok-4-1-fast',
        name: 'xAI: Grok 4.1 Fast',
        context_length: 2000000
      },
      // Filter target: embedding — drop
      {
        id: 'openai/text-embedding-3-large',
        name: 'OpenAI: Text Embedding 3 Large',
        context_length: 8192
      },
      // Filter target: context_length 0 — drop per OpenRouter rule
      {
        id: 'some/zero-context-model',
        name: 'Zero Context',
        context_length: 0
      }
    ]
  }
};

/**
 * Error / failure-mode fixtures for the discovery module.
 * Numeric keys are HTTP status codes; the `network` key is a thrower factory
 * that simulates a fetch-level failure (TypeError), as the spec requires a
 * "network-error simulator (a function that throws TypeError)".
 */
const ERROR_FIXTURES = {
  '401': {
    status: 401,
    body: { error: { message: 'Invalid API key', type: 'authentication_error' } }
  },
  '403': {
    status: 403,
    body: { error: { message: 'Forbidden', type: 'permission_error' } }
  },
  '429': {
    status: 429,
    body: { error: { message: 'Rate limited', type: 'rate_limit_error' } }
  },
  '500': {
    status: 500,
    body: { error: { message: 'Internal server error', type: 'server_error' } }
  },
  // Simulator: invoke this to obtain a fetch-shaped function that always throws TypeError,
  // matching how browsers surface CORS / DNS / offline failures.
  network: () => {
    return () => { throw new TypeError('Failed to fetch'); };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RESPONSE_FIXTURES, ERROR_FIXTURES };
}
