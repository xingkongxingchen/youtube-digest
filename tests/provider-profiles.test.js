const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const settings = require("../settings.js");
let adapters = null;
let adaptersLoadError = null;
try {
  adapters = require("../ai-providers.js");
} catch (error) {
  adaptersLoadError = error;
}

const REQUIRED_PRESET_IDS = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "minimax",
  "mimo",
];

const SAMPLE_REQUEST = Object.freeze({
  messages: [
    { role: "system", content: "Return a concise answer." },
    { role: "user", content: "Explain semantic caching." },
  ],
  temperature: 0.2,
  maxTokens: 512,
  responseFormat: { type: "json_object" },
});

function presetList() {
  const presets = settings.PROVIDER_PRESETS;
  if (Array.isArray(presets)) {
    return presets.map((preset) => ({ ...preset, id: preset.id || preset.type }));
  }
  if (presets && typeof presets === "object") {
    return Object.entries(presets).map(([id, preset]) => ({
      ...preset,
      id: preset.id || preset.type || id,
    }));
  }
  return [];
}

function presetById(id) {
  return presetList().find((preset) => preset.id === id);
}

function migratedSettings(input) {
  const result = settings.migrateSettings(input);
  return result?.settings || result;
}

function requestBody(request) {
  return typeof request.body === "string" ? JSON.parse(request.body) : request.body;
}

function header(request, name) {
  const match = Object.entries(request.headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1];
}

function validProfile(overrides = {}) {
  return {
    id: "profile-test",
    type: "custom-openai",
    name: "Test Provider",
    baseUrl: "https://llm.example.com/v1",
    model: "example-chat",
    apiKey: "test-key",
    ...overrides,
  };
}

function providerFromPreset(id, overrides = {}) {
  return settings.createProviderFromPreset(id, {
    id: `${id}-profile`,
    apiKey: "test-key",
    ...overrides,
  });
}

function requireAdapterContract() {
  assert.ifError(adaptersLoadError);
  assert.equal(typeof adapters.buildProviderRequest, "function");
  assert.equal(typeof adapters.parseProviderResponse, "function");
  return adapters;
}

test("provider modules expose the v1.4 pure-function contract", () => {
  assert.equal(settings.SCHEMA_VERSION, 2);
  for (const name of [
    "normalizeProvider",
    "validateProvider",
    "normalize",
    "migrateSettings",
    "getActiveProvider",
    "providerOriginPattern",
    "endpointUrl",
    "createProviderFromPreset",
  ]) {
    assert.equal(typeof settings[name], "function", `settings.${name}`);
  }
  requireAdapterContract();
});

test("the catalog has seven built-ins plus a separate custom-openai preset", () => {
  const presets = presetList();
  assert.equal(presets.length, 7);
  assert.deepEqual(
    presets.map((preset) => preset.id).sort(),
    [...REQUIRED_PRESET_IDS].sort(),
  );
  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length);

  const custom = settings.CUSTOM_OPENAI_PRESET;
  assert.ok(custom);
  assert.equal(custom.type, "custom-openai");
  assert.equal(custom.baseUrl, "");
  assert.equal(custom.model, "");
  for (const preset of presets) {
    assert.ok(preset.name || preset.label, `${preset.id} needs a display name`);
    assert.ok(preset.baseUrl, `${preset.id} needs a default base URL`);
    assert.ok(preset.model, `${preset.id} needs a default model`);
    assert.doesNotMatch(JSON.stringify(preset), /(?:sk|key)-[A-Za-z0-9]{8,}/i);
  }
});

test("v1.3 DeepSeek settings migrate once into schemaVersion 2", () => {
  const legacy = {
    provider: "deepseek",
    aiApiKey: "  legacy-deepseek-key  ",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
    supadataApiKey: "  legacy-supadata-key  ",
  };
  const migrated = migratedSettings(legacy);

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.supadataApiKey, "legacy-supadata-key");
  assert.equal(migrated.providers.length, 1);
  assert.equal(migrated.activeProviderId, migrated.providers[0].id);
  assert.equal(migrated.providers[0].type, "deepseek");
  assert.equal(migrated.providers[0].baseUrl, "https://api.deepseek.com");
  assert.equal(migrated.providers[0].model, "deepseek-v4-flash");
  assert.equal(migrated.providers[0].apiKey, "legacy-deepseek-key");

  assert.deepEqual(
    settings.normalize(migrated),
    settings.normalize(settings.normalize(migrated)),
    "schemaVersion 2 normalization must be idempotent",
  );
});

test("an empty installation gets one active DeepSeek profile without a key", () => {
  const normalized = settings.normalize({});
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.supadataApiKey, "");
  assert.equal(normalized.providers.length, 1);
  assert.equal(normalized.providers[0].type, "deepseek");
  assert.equal(normalized.providers[0].apiKey, "");
  assert.equal(normalized.activeProviderId, normalized.providers[0].id);
  assert.equal(settings.getActiveProvider(normalized).id, normalized.providers[0].id);
});

test("provider IDs, HTTPS URLs, models, and duplicate profiles normalize safely", () => {
  for (const unsafeId of ["UPPER CASE", "../escape", "", "id with spaces"] ) {
    assert.match(settings.normalizeProvider(validProfile({ id: unsafeId })).id, /^[A-Za-z0-9_-]+$/);
  }

  for (const baseUrl of [
    "javascript:alert(1)",
    "ftp://llm.example.com/v1",
    "http://localhost:11434/v1",
    "https://user:pass@llm.example.com/v1",
  ]) {
    const result = settings.validateProvider(validProfile({ baseUrl }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => /HTTPS|API 地址/.test(error)));
  }

  const cleanedUrl = settings.normalizeProvider(
    validProfile({ baseUrl: "https://llm.example.com/v1/?secret=value#fragment" }),
  ).baseUrl;
  assert.equal(cleanedUrl, "https://llm.example.com/v1");
  assert.equal(settings.validateProvider(validProfile()).valid, true);
  const missingModel = settings.validateProvider(validProfile({ model: "" }));
  assert.equal(missingModel.valid, false);
  assert.ok(missingModel.errors.some((error) => /模型/.test(error)));

  const normalized = settings.normalize({
    schemaVersion: 2,
    providers: [validProfile({ id: "duplicate" }), validProfile({ id: "duplicate" })],
    activeProviderId: "duplicate",
  });
  assert.equal(new Set(normalized.providers.map((provider) => provider.id)).size, 2);
  assert.equal(normalized.providers[0].id, "duplicate");
  assert.match(normalized.providers[1].id, /^duplicate-\d+$/);
});

test("activeProviderId selects one profile and invalid references recover safely", () => {
  const first = validProfile({ id: "first", name: "First" });
  const second = validProfile({ id: "second", name: "Second" });
  const settingsValue = settings.normalize({
    schemaVersion: 2,
    providers: [first, second],
    activeProviderId: "second",
  });
  assert.equal(settings.getActiveProvider(settingsValue).id, "second");

  const recovered = settings.normalize({
    ...settingsValue,
    activeProviderId: "missing",
  });
  assert.equal(recovered.activeProviderId, recovered.providers[0].id);
  assert.equal(settings.getActiveProvider(recovered).id, recovered.providers[0].id);
});

test("preset creation preserves provider identity while custom-openai accepts user fields", () => {
  for (const id of REQUIRED_PRESET_IDS) {
    const provider = providerFromPreset(id);
    assert.equal(provider.type, id);
    assert.equal(provider.id, `${id}-profile`);
    assert.equal(provider.apiKey, "test-key");
    assert.ok(provider.baseUrl);
    assert.ok(provider.model);
  }

  const custom = providerFromPreset("custom-openai", {
    id: "company-gateway",
    name: "Company Gateway",
    baseUrl: "https://gateway.example.com/openai/v1/",
    model: "company-chat",
  });
  assert.equal(custom.type, "custom-openai");
  assert.equal(custom.baseUrl, "https://gateway.example.com/openai/v1");
  assert.equal(custom.model, "company-chat");
});

test("origin and endpoint helpers emit only the minimum provider origin", () => {
  assert.equal(
    settings.providerOriginPattern("https://api.openai.com/v1"),
    "https://api.openai.com/*",
  );
  assert.equal(
    settings.providerOriginPattern("https://gateway.example.com:8443/openai/v1/"),
    "https://gateway.example.com:8443/*",
  );
  assert.equal(
    settings.providerOriginPattern("https://localhost:11434/v1"),
    "https://localhost:11434/*",
  );
  assert.throws(() => settings.providerOriginPattern("http://localhost:11434/v1"));
  assert.throws(() => settings.providerOriginPattern("https://user:pass@example.com/v1"));

  assert.match(settings.endpointUrl(providerFromPreset("openai")), /\/chat\/completions$/);
  assert.match(settings.endpointUrl(providerFromPreset("anthropic")), /\/v1\/messages$/);
  assert.equal(
    settings.endpointUrl(providerFromPreset("minimax")),
    "https://api.minimaxi.com/anthropic/v1/messages",
  );
  assert.match(
    settings.endpointUrl(providerFromPreset("gemini")),
    /\/v1beta\/models\/[^/]+:generateContent$/,
  );
});

test("OpenAI-compatible requests use bearer auth and parse chat completions", () => {
  const { buildProviderRequest, parseProviderResponse } = requireAdapterContract();
  const profile = providerFromPreset("custom-openai", {
    id: "compatible-profile",
    name: "Compatible API",
    baseUrl: "https://compatible.example.com/v1",
    model: "compatible-chat",
    apiKey: "test-key",
  });
  const request = buildProviderRequest(profile, SAMPLE_REQUEST);
  const body = requestBody(request);

  assert.match(request.url, /\/chat\/completions$/);
  assert.equal(request.method, "POST");
  assert.equal(header(request, "authorization"), "Bearer test-key");
  assert.equal(header(request, "content-type"), "application/json");
  assert.equal(body.model, profile.model);
  assert.deepEqual(body.messages, SAMPLE_REQUEST.messages);
  assert.equal(body.max_tokens, 512);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(
    parseProviderResponse(profile, {
      choices: [{ message: { content: "OpenAI response" } }],
    }),
    "OpenAI response",
  );
});

test("Claude requests separate system content and parse only text blocks", () => {
  const { buildProviderRequest, parseProviderResponse } = requireAdapterContract();
  const profile = providerFromPreset("anthropic", { apiKey: "test-key" });
  const request = buildProviderRequest(profile, SAMPLE_REQUEST);
  const body = requestBody(request);

  assert.match(request.url, /\/v1\/messages$/);
  assert.equal(header(request, "x-api-key"), "test-key");
  assert.ok(header(request, "anthropic-version"));
  assert.equal(body.system, SAMPLE_REQUEST.messages[0].content);
  assert.deepEqual(body.messages, SAMPLE_REQUEST.messages.slice(1));
  assert.equal(body.max_tokens, 512);
  assert.equal(Object.hasOwn(body, "response_format"), false);
  assert.equal(
    parseProviderResponse(profile, {
      content: [
        { type: "thinking", thinking: "private reasoning" },
        { type: "text", text: "Claude " },
        { type: "text", text: "response" },
      ],
    }),
    "Claude response",
  );
});

test("Gemini requests use x-goog-api-key and native contents", () => {
  const { buildProviderRequest, parseProviderResponse } = requireAdapterContract();
  const profile = providerFromPreset("gemini", { apiKey: "test-key" });
  const request = buildProviderRequest(profile, SAMPLE_REQUEST);
  const body = requestBody(request);

  assert.match(request.url, new RegExp(`/models/${profile.model}:generateContent$`));
  assert.equal(header(request, "x-goog-api-key"), "test-key");
  assert.doesNotMatch(request.url, /test-key/);
  assert.equal(body.systemInstruction.parts[0].text, SAMPLE_REQUEST.messages[0].content);
  assert.deepEqual(body.contents, [
    { role: "user", parts: [{ text: "Explain semantic caching." }] },
  ]);
  assert.equal(body.generationConfig.maxOutputTokens, 512);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(
    parseProviderResponse(profile, {
      candidates: [{ content: { parts: [{ text: "Gemini " }, { text: "response" }] } }],
    }),
    "Gemini response",
  );
});

test("DeepSeek, MiniMax, and MiMo keep provider-specific request rules isolated", () => {
  const { buildProviderRequest, parseProviderResponse } = requireAdapterContract();
  const deepSeek = providerFromPreset("deepseek");
  const miniMax = providerFromPreset("minimax");
  const mimo = providerFromPreset("mimo");
  const deepSeekBody = requestBody(buildProviderRequest(deepSeek, SAMPLE_REQUEST));
  const miniMaxRequest = buildProviderRequest(miniMax, SAMPLE_REQUEST);
  const miniMaxBody = requestBody(miniMaxRequest);
  const mimoBody = requestBody(buildProviderRequest(mimo, SAMPLE_REQUEST));

  assert.equal(deepSeekBody.max_tokens, 512);
  assert.deepEqual(deepSeekBody.thinking, { type: "disabled" });
  assert.equal(Object.hasOwn(deepSeekBody, "max_completion_tokens"), false);

  assert.equal(miniMaxRequest.url, "https://api.minimaxi.com/anthropic/v1/messages");
  assert.equal(header(miniMaxRequest, "authorization"), "Bearer test-key");
  assert.equal(header(miniMaxRequest, "x-api-key"), undefined);
  assert.equal(miniMaxBody.system, SAMPLE_REQUEST.messages[0].content);
  assert.deepEqual(miniMaxBody.messages, SAMPLE_REQUEST.messages.slice(1));
  assert.equal(miniMaxBody.max_tokens, 512);
  assert.equal(miniMaxBody.temperature, 0.2);
  assert.equal(Object.hasOwn(miniMaxBody, "thinking"), false);
  assert.equal(Object.hasOwn(miniMaxBody, "reasoning_split"), false);
  assert.equal(Object.hasOwn(miniMaxBody, "max_completion_tokens"), false);
  assert.equal(Object.hasOwn(miniMaxBody, "response_format"), false);
  assert.equal(miniMaxBody.model, miniMax.model);

  assert.equal(mimoBody.max_completion_tokens, 512);
  assert.deepEqual(mimoBody.thinking, { type: "disabled" });
  assert.equal(Object.hasOwn(mimoBody, "max_tokens"), false);
  assert.equal(mimoBody.model, mimo.model);
  assert.notEqual(miniMax.baseUrl, mimo.baseUrl);

  assert.equal(
    parseProviderResponse(miniMax, {
      content: [
        { type: "thinking", thinking: "hidden" },
        { type: "text", text: "MiniMax " },
        { type: "text", text: "response" },
      ],
    }),
    "MiniMax response",
  );

  assert.equal(
    parseProviderResponse(mimo, {
      choices: [{ message: { reasoning_content: "hidden", content: "MiMo response" } }],
    }),
    "MiMo response",
  );
});

test("MiniMax builds valid connection-test, overview, and translation requests", () => {
  const { buildProviderRequest } = requireAdapterContract();
  const miniMax = providerFromPreset("minimax");
  const requestFor = (overrides) => requestBody(buildProviderRequest(miniMax, {
    ...SAMPLE_REQUEST,
    ...overrides,
  }));

  const connectionTest = requestFor({ maxTokens: 12, temperature: 0, responseFormat: undefined });
  assert.equal(connectionTest.max_tokens, 12);
  assert.equal(Object.hasOwn(connectionTest, "temperature"), false);

  const overview = requestFor({ maxTokens: 8192, temperature: 0.2, responseFormat: undefined });
  assert.equal(overview.max_tokens, 8192);
  assert.equal(overview.temperature, 0.2);

  const translation = requestFor({
    maxTokens: 8192,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
  });
  assert.equal(translation.max_tokens, 8192);
  assert.equal(translation.temperature, 0.3);
  assert.equal(Object.hasOwn(translation, "response_format"), false);

  for (const body of [connectionTest, overview, translation]) {
    assert.equal(body.system, SAMPLE_REQUEST.messages[0].content);
    assert.deepEqual(body.messages, SAMPLE_REQUEST.messages.slice(1));
    assert.equal(Object.hasOwn(body, "max_completion_tokens"), false);
  }
});

test("secrets never appear in validation errors, parser errors, presets, or logs", () => {
  const { buildProviderRequest, parseProviderResponse } = requireAdapterContract();
  const secret = ["never", "leak", "this", "api", "key"].join("-");
  const invalid = validProfile({ apiKey: secret, baseUrl: "javascript:bad" });
  const validation = settings.validateProvider(invalid);
  assert.equal(validation.valid, false);
  assert.doesNotMatch(validation.errors.join("\n"), new RegExp(secret));

  const profile = providerFromPreset("openai", { apiKey: secret });
  assert.throws(
    () => parseProviderResponse(profile, { error: { message: `provider echoed ${secret}` } }),
    (error) => !String(error?.message || error).includes(secret),
  );
  assert.throws(
    () => buildProviderRequest(validProfile({ apiKey: secret, model: "" }), SAMPLE_REQUEST),
    (error) => !String(error?.message || error).includes(secret),
  );

  const sources = ["settings.js", "ai-providers.js", "background.js"]
    .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
    .join("\n");
  assert.doesNotMatch(sources, /console\.(?:log|info|warn|error)\([^\n]*(?:apiKey|providers?|settings)/i);
  assert.doesNotMatch(JSON.stringify(settings.PROVIDER_PRESETS), /never-leak|api[_-]?key\s*[:=]\s*["'][^"']+/i);
});
