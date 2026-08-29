/**
 * Shared Provider profile defaults, migration, and validation.
 * API keys live only in chrome.storage.local; no real credentials belong here.
 */
var YTD_SETTINGS = (() => {
  const STORAGE_KEY = "ytd_settings";
  const SCHEMA_VERSION = 2;
  const DEFAULT_PROVIDER_ID = "deepseek-default";
  const PROVIDER_TYPES = Object.freeze([
    "deepseek", "openai", "anthropic", "gemini", "openrouter",
    "minimax", "mimo", "custom-openai",
  ]);
  const PROVIDER_PRESETS = Object.freeze([
    Object.freeze({ type: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" }),
    Object.freeze({ type: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini" }),
    Object.freeze({ type: "anthropic", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-6" }),
    Object.freeze({ type: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.5-flash" }),
    Object.freeze({ type: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-5-mini" }),
    Object.freeze({ type: "minimax", name: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M2.7" }),
    Object.freeze({ type: "mimo", name: "小米 MiMo", baseUrl: "https://api.xiaomimimo.com/v1", model: "mimo-v2.5-pro" }),
  ]);
  const CUSTOM_OPENAI_PRESET = Object.freeze({
    type: "custom-openai",
    name: "自定义 OpenAI 兼容服务",
    baseUrl: "",
    model: "",
  });

  function presetFor(type) {
    return PROVIDER_PRESETS.find((preset) => preset.type === type) ||
      (type === CUSTOM_OPENAI_PRESET.type ? CUSTOM_OPENAI_PRESET : null);
  }

  function cleanText(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }

  function normalizeBaseUrl(value) {
    const raw = cleanText(value, 2048).replace(/\/+$/, "");
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password) return "";
      url.hash = "";
      url.search = "";
      return url.toString().replace(/\/$/, "");
    } catch (_error) {
      return "";
    }
  }

  function normalizeProvider(input = {}, index = 0) {
    const requestedType = cleanText(input.type, 40);
    const type = PROVIDER_TYPES.includes(requestedType) ? requestedType : "custom-openai";
    const preset = presetFor(type) || CUSTOM_OPENAI_PRESET;
    const fallbackId = `${type}-${index + 1}`;
    const id = cleanText(input.id, 100).replace(/[^A-Za-z0-9_-]/g, "") || fallbackId;
    return {
      id,
      type,
      name: cleanText(input.name, 80) || preset.name,
      baseUrl: normalizeBaseUrl(input.baseUrl || preset.baseUrl),
      model: cleanText(input.model || preset.model, 200),
      apiKey: cleanText(input.apiKey, 4096),
    };
  }

  function validateProvider(input) {
    const provider = normalizeProvider(input);
    const errors = [];
    if (!provider.name) errors.push("请输入 Provider 名称。");
    if (!provider.baseUrl) errors.push("请输入有效的 HTTPS API 地址。");
    if (!provider.model) errors.push("请输入模型名称。");
    if (!provider.apiKey) errors.push("请输入 API Key。");
    return { valid: errors.length === 0, errors, provider };
  }

  function createProviderFromPreset(type, overrides = {}) {
    const preset = presetFor(type);
    if (!preset) throw new Error("不支持的 Provider 预设。");
    return normalizeProvider({ ...preset, ...overrides });
  }

  function legacyToV2(input = {}) {
    const legacyCustom = input?.provider === "custom";
    const deepseek = createProviderFromPreset("deepseek", {
      id: DEFAULT_PROVIDER_ID,
      apiKey: legacyCustom ? "" : cleanText(input?.aiApiKey, 4096),
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      supadataApiKey: cleanText(input?.supadataApiKey, 4096),
      activeProviderId: deepseek.id,
      providers: [deepseek],
    };
  }

  function normalize(input = {}) {
    if (input?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(input.providers)) {
      return legacyToV2(input);
    }
    const usedIds = new Set();
    const providers = [];
    input.providers.slice(0, 50).forEach((item, index) => {
      const provider = normalizeProvider(item, index);
      let id = provider.id;
      let suffix = 2;
      while (usedIds.has(id)) id = `${provider.id}-${suffix++}`;
      usedIds.add(id);
      providers.push({ ...provider, id });
    });
    if (!providers.length) {
      providers.push(createProviderFromPreset("deepseek", { id: DEFAULT_PROVIDER_ID }));
    }
    const requestedActiveId = cleanText(input.activeProviderId, 100);
    const activeProviderId = providers.some((provider) => provider.id === requestedActiveId)
      ? requestedActiveId
      : providers[0].id;
    return {
      schemaVersion: SCHEMA_VERSION,
      supadataApiKey: cleanText(input.supadataApiKey, 4096),
      activeProviderId,
      providers,
    };
  }

  function migrateSettings(input = {}) {
    const migrated = input?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(input.providers);
    return { settings: normalize(input), migrated };
  }

  function migrateLegacyCustom(input = {}) {
    return migrateSettings(input);
  }

  function getActiveProvider(settings) {
    const normalized = normalize(settings);
    return normalized.providers.find((provider) => provider.id === normalized.activeProviderId) || normalized.providers[0];
  }

  function providerOriginPattern(baseUrl) {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) throw new Error("请输入有效的 HTTPS API 地址。");
    return `${new URL(normalized).origin}/*`;
  }

  function endpointUrl(providerInput) {
    const provider = normalizeProvider(providerInput);
    if (!provider.baseUrl) throw new Error("Provider API 地址无效。");
    if (provider.type === "anthropic") {
      return provider.baseUrl.endsWith("/v1/messages") ? provider.baseUrl : `${provider.baseUrl}/v1/messages`;
    }
    if (provider.type === "gemini") {
      const base = provider.baseUrl.replace(/\/models\/.*$/, "");
      return `${base}/models/${encodeURIComponent(provider.model)}:generateContent`;
    }
    return provider.baseUrl.endsWith("/chat/completions") ? provider.baseUrl : `${provider.baseUrl}/chat/completions`;
  }

  function canonicalYouTubeUrl(videoId) {
    const normalized = String(videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(normalized)) throw new Error("无效的 YouTube 视频标识符。");
    return `https://www.youtube.com/watch?v=${normalized}`;
  }

  return {
    STORAGE_KEY, SCHEMA_VERSION, DEFAULT_PROVIDER_ID, PROVIDER_TYPES,
    PROVIDER_PRESETS, CUSTOM_OPENAI_PRESET, normalizeBaseUrl,
    normalizeProvider, validateProvider, createProviderFromPreset, normalize,
    migrateSettings, migrateLegacyCustom, getActiveProvider,
    providerOriginPattern, endpointUrl, canonicalYouTubeUrl,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = YTD_SETTINGS;
