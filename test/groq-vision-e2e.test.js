'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { MODES } = require('../src/prompts');

// Mock OpenAI SDK to inspect the exact payload sent to Groq
let capturedClientOptions = null;
let capturedCompletionRequest = null;
const originalModuleLoad = Module._load;

Module._load = function stubOpenAIForGroq(request, parent, isMain) {
  if (request === 'openai') {
    return class FakeOpenAI {
      constructor(clientOptions) {
        capturedClientOptions = clientOptions;
        this.chat = {
          completions: {
            create: async (completionRequest) => {
              capturedCompletionRequest = completionRequest;
              return [{ choices: [{ delta: { content: 'Solution generated.' } }] }];
            }
          }
        };
      }
    };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

const { createLLM, GROQ_VISION_MODELS } = require('../src/llm');

test.after(() => {
  Module._load = originalModuleLoad;
});

test.beforeEach(() => {
  capturedClientOptions = null;
  capturedCompletionRequest = null;
});

test('Groq Provider End-to-End Vision & Mode Verification', async (t) => {

  const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  await t.test('Assist Mode with Groq (Fast Tier): Automatically uses llama-3.2-11b-vision-preview', async () => {
    const settings = {
      provider: 'groq',
      smart: false,
      apiKeys: { groq: 'gsk_mock_api_key' },
      models: { groq: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' } }
    };

    const llm = createLLM(settings);
    assert.equal(llm.ready, true);
    assert.equal(llm.model, 'llama-3.1-8b-instant');

    // Simulate Assist mode
    const mode = 'assist';
    const def = MODES[mode];
    const system = def.buildSystem(null, '', { hasScreen: true });
    const userPrompt = def.build({ transcript: [], userText: '' }, { hasScreen: true });

    const tokens = [];
    await llm.stream({
      system,
      turns: [{ role: 'user', text: userPrompt }],
      imageDataUrl: dummyImage,
      onToken: (tok) => tokens.push(tok)
    });

    // Verify endpoint
    assert.equal(capturedClientOptions.baseURL, 'https://api.groq.com/openai/v1');
    assert.equal(capturedClientOptions.apiKey, 'gsk_mock_api_key');

    // CRITICAL: Verify model was automatically upgraded from llama-3.1-8b-instant to llama-3.2-11b-vision-preview!
    assert.equal(capturedCompletionRequest.model, GROQ_VISION_MODELS.fast);
    assert.equal(capturedCompletionRequest.model, 'llama-3.2-11b-vision-preview');

    // Verify image payload was properly structured
    const userMessage = capturedCompletionRequest.messages.find(m => m.role === 'user');
    assert.ok(Array.isArray(userMessage.content), 'user message content must be multipart array');
    assert.equal(userMessage.content[0].type, 'text');
    assert.equal(userMessage.content[1].type, 'image_url');
    assert.equal(userMessage.content[1].image_url.url, dummyImage);
    assert.deepEqual(tokens, ['Solution generated.']);
  });

  await t.test('LeetCode Mode with Groq (Smart Tier): Automatically uses llama-3.2-90b-vision-preview', async () => {
    const settings = {
      provider: 'groq',
      smart: true,
      apiKeys: { groq: 'gsk_mock_api_key' },
      models: { groq: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' } }
    };

    const llm = createLLM(settings);
    assert.equal(llm.ready, true);
    assert.equal(llm.model, 'llama-3.3-70b-versatile');

    // Simulate LeetCode mode
    const mode = 'leetcode';
    const def = MODES[mode];
    const system = def.buildSystem(null, null);
    const userPrompt = def.build();

    await llm.stream({
      system,
      turns: [{ role: 'user', text: userPrompt }],
      imageDataUrl: dummyImage,
      onToken: () => {}
    });

    // CRITICAL: Verify model was automatically upgraded from llama-3.3-70b-versatile to llama-3.2-90b-vision-preview!
    assert.equal(capturedCompletionRequest.model, GROQ_VISION_MODELS.smart);
    assert.equal(capturedCompletionRequest.model, 'llama-3.2-90b-vision-preview');

    // Verify system prompt is strict competitive programmer instructions
    assert.match(capturedCompletionRequest.messages[0].content, /competitive programmer/i);
    // Verify image_url is present
    const userMessage = capturedCompletionRequest.messages.find(m => m.role === 'user');
    assert.equal(userMessage.content[1].type, 'image_url');
  });

  await t.test('Screen Vision Toggle ON with Custom Question: Falls back to vision model', async () => {
    const settings = {
      provider: 'groq',
      smart: false,
      apiKeys: { groq: 'gsk_mock_api_key' },
      models: { groq: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' } }
    };

    const llm = createLLM(settings);

    // User asks a custom question with screen vision enabled
    await llm.stream({
      system: 'You are cue.',
      turns: [{ role: 'user', text: 'Explain what is wrong with this terminal output' }],
      imageDataUrl: dummyImage,
      onToken: () => {}
    });

    assert.equal(capturedCompletionRequest.model, 'llama-3.2-11b-vision-preview');
    const userMessage = capturedCompletionRequest.messages.find(m => m.role === 'user');
    assert.equal(userMessage.content[1].type, 'image_url');
  });

  await t.test('Text-Only Queries: Strictly preserve ultra-fast text models without fallback', async () => {
    // Fast Tier Text Query
    const fastLLM = createLLM({
      provider: 'groq',
      smart: false,
      apiKeys: { groq: 'gsk_mock_api_key' },
      models: { groq: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' } }
    });

    await fastLLM.stream({
      system: 'You are cue.',
      turns: [{ role: 'user', text: 'What is a closure in JavaScript?' }],
      imageDataUrl: null, // No image
      onToken: () => {}
    });

    assert.equal(capturedCompletionRequest.model, 'llama-3.1-8b-instant');
    const fastUserMsg = capturedCompletionRequest.messages.find(m => m.role === 'user');
    assert.equal(typeof fastUserMsg.content, 'string', 'Text-only message content must be string, not array');
    assert.equal(fastUserMsg.content, 'What is a closure in JavaScript?');

    // Smart Tier Text Query
    const smartLLM = createLLM({
      provider: 'groq',
      smart: true,
      apiKeys: { groq: 'gsk_mock_api_key' },
      models: { groq: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' } }
    });

    await smartLLM.stream({
      system: 'You are cue.',
      turns: [{ role: 'user', text: 'Compare optimistic vs pessimistic concurrency control' }],
      imageDataUrl: null, // No image
      onToken: () => {}
    });

    assert.equal(capturedCompletionRequest.model, 'llama-3.3-70b-versatile');
    const smartUserMsg = capturedCompletionRequest.messages.find(m => m.role === 'user');
    assert.equal(typeof smartUserMsg.content, 'string');
  });

  await t.test('User-configured Vision Model: Leaves model untouched', async () => {
    const customVisionLLM = createLLM({
      provider: 'groq',
      smart: false,
      apiKeys: { groq: 'gsk_mock_api_key' },
      models: { groq: { fast: 'llama-3.2-11b-vision-preview', smart: 'llama-3.2-90b-vision-preview' } }
    });

    await customVisionLLM.stream({
      system: 'You are cue.',
      turns: [{ role: 'user', text: 'analyze screen' }],
      imageDataUrl: dummyImage,
      onToken: () => {}
    });

    assert.equal(capturedCompletionRequest.model, 'llama-3.2-11b-vision-preview');
  });

});
