const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

test("v1.3 DeepSeek settings migrate into one active v1.4 profile", () => {
  const normalized = settings.normalize({
    provider: "deepseek",
    aiApiKey: "  example-key  ",
    supadataApiKey: "  example-supadata  ",
  });
  const provider = settings.getActiveProvider(normalized);

  assert.equal(normalized.schemaVersion, 2);
  assert.equal(provider.type, "deepseek");
  assert.equal(provider.baseUrl, "https://api.deepseek.com");
  assert.equal(provider.model, "deepseek-v4-flash");
  assert.equal(provider.apiKey, "example-key");
  assert.equal(normalized.supadataApiKey, "example-supadata");
  assert.equal(
    settings.endpointUrl(provider),
    "https://api.deepseek.com/chat/completions",
  );
});

test("legacy custom migration clears only the AI key and is idempotent", () => {
  const legacy = {
    provider: "custom",
    aiApiKey: "custom-secret",
    aiBaseUrl: "https://api.example.com/v1",
    aiModel: "example-model",
    supadataApiKey: " supadata-secret ",
  };
  const first = settings.migrateLegacyCustom(legacy);
  const firstProvider = settings.getActiveProvider(first.settings);

  assert.equal(first.migrated, true);
  assert.equal(firstProvider.type, "deepseek");
  assert.equal(firstProvider.baseUrl, "https://api.deepseek.com");
  assert.equal(firstProvider.model, "deepseek-v4-flash");
  assert.equal(firstProvider.apiKey, "");
  assert.equal(first.settings.supadataApiKey, "supadata-secret");

  const second = settings.migrateLegacyCustom(first.settings);
  assert.equal(second.migrated, false);
  assert.deepEqual(second.settings, first.settings);

  const configuredDeepSeek = settings.normalize({
    ...first.settings,
    providers: [{ ...firstProvider, apiKey: "new-key" }],
  });
  assert.equal(settings.getActiveProvider(configuredDeepSeek).apiKey, "new-key");
});

test("Supadata receives a canonical YouTube URL", () => {
  assert.equal(
    settings.canonicalYouTubeUrl("ydTeb_I0b94"),
    "https://www.youtube.com/watch?v=ydTeb_I0b94",
  );
  assert.throws(
    () => settings.canonicalYouTubeUrl('"><script>'),
    /无效的 YouTube 视频标识符/,
  );
});
