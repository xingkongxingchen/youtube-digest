const YTD_OPTIONS = (() => {
  const LANGUAGE_STORAGE_KEY = "ytd_options_language";
  const PREVIEW_STORAGE_PREFIX = "youtubeDigestPreview:";
  const DEFAULT_LANGUAGE = "zh-CN";
  const SUPPORTED_LANGUAGES = new Set(["en", "zh-CN"]);
  const PROVIDER_SCHEMA_VERSION = 2;
  const PROVIDER_PRESETS = Object.freeze({
    deepseek: Object.freeze({
      type: "deepseek",
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    }),
    openai: Object.freeze({
      type: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5-mini",
    }),
    claude: Object.freeze({
      type: "anthropic",
      name: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
    }),
    gemini: Object.freeze({
      type: "gemini",
      name: "Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.5-flash",
    }),
    openrouter: Object.freeze({
      type: "openrouter",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-5-mini",
    }),
    minimax: Object.freeze({
      type: "minimax",
      name: "MiniMax",
      baseUrl: "https://api.minimaxi.com/anthropic",
      model: "MiniMax-M2.7",
    }),
    mimo: Object.freeze({
      type: "mimo",
      name: "小米 MiMo",
      baseUrl: "https://api.xiaomimimo.com/v1",
      model: "mimo-v2.5-pro",
    }),
    custom: Object.freeze({
      type: "custom-openai",
      name: "自定义 OpenAI 兼容服务",
      baseUrl: "",
      model: "",
    }),
  });

  const COPY = {
    en: {
      pageTitle: "YouTube Digest Settings",
      languageGroupLabel: "Interface language",
      heading: "Bring your own API keys",
      lede:
        "Keys stay in this Chrome profile and are used only for Supadata, the Provider you enable, and a Provider you explicitly test. This open-source extension has no developer server or analytics.",
      transcriptProvider: "Transcript provider",
      supadataApiKeyLabel: "Supadata API key",
      supadataHelp: "Used to fetch timestamped YouTube subtitles. ",
      supadataLink: "Create a Supadata account and key",
      supadataHelpSuffix:
        ". Supadata generates the key during onboarding.",
      aiProvider: "AI provider",
      providerSummaryLabel: "Supported AI provider",
      providerBadge: "Supported in this version",
      deepseekApiKeyLabel: "DeepSeek API key",
      deepseekHelp:
        "YouTube Digest uses DeepSeek V4 Flash for overviews, explanations, translation, and note polishing. ",
      deepseekLink: "Create a DeepSeek API key",
      deepseekHelpSuffix: ".",
      privacyNote:
        "When you use AI features, DeepSeek receives the video transcript and relevant video context. Review DeepSeek's terms and pricing before saving.",
      saveSettings: "Save settings",
      localRemix: "Local remix",
      customizationTitle: "Want to use another AI model?",
      customizationPurpose: "Edit and copy a safe prompt for your coding agent",
      agentBadge: "Coding agent ready",
      customizationIntro:
        "You can edit the prompt directly. Complete these three steps before copying:",
      customizationStepFolder:
        "Open the extracted YouTube Digest project folder in your coding agent.",
      customizationStepReplace:
        "Replace [PROVIDER] and [MODEL] with the service and model you want to use.",
      customizationStepKeys:
        "Never include API keys in the prompt or chat. Enter them yourself after the code is ready.",
      customizationPromptLabel: "Editable customization prompt",
      customizationReminderLabel: "Prompt reminder",
      customizationReminder:
        "Before copying, replace [PROVIDER] and [MODEL] with the provider and model you want to use.",
      customizationPrompt:
        "Customize this local YouTube Digest workspace to use [PROVIDER] with [MODEL]. Work only in the current workspace. Before editing, verify that it contains manifest.json and that the manifest name is YouTube Digest. If verification fails, stop and ask me to open the extracted YouTube Digest project folder in my coding agent. Do not search other folders, edit a guessed copy, assume an installation path, or claim Chrome can reveal the absolute OS source path. Update the provider's API endpoint, request format, and minimum Chrome host permissions. Preserve bring-your-own-key and local Chrome storage. Never put API keys in source code, commits, logs, screenshots, this prompt, or chat; after the code is ready, tell me where to enter the key myself. Keep DeepSeek-only request fields and retry behavior isolated to DeepSeek. Handle provider-specific rules separately so one provider does not affect another. Update README.md, README.zh-CN.md, PRIVACY.md, SECURITY.md, and tests. Run npm test, npm run check, and npm run package. Then explain how to reload the unpacked extension and test it on a real YouTube video.",
      copyCustomizationPrompt: "Copy edited prompt",
      localData: "Local data",
      localDataHelp:
        "Digests, translations, and notes are stored only in this Chrome profile. You can remove them at any time.",
      clearCache: "Clear cached digests",
      deleteNotes: "Delete all notes",
      resetData: "Reset extension data",
      footer:
        'Read <a href="PRIVACY.md" target="_blank">PRIVACY.md</a> in the repository for the complete data-flow description.',
      migrationWarning:
        "Settings were upgraded to Provider cards. Choose Save settings to approve access to the active Provider origin. An unidentifiable legacy custom key is not migrated.",
      saving: "Saving…",
      addSupadataKey: "Add a Supadata API key.",
      addDeepseekKey: "Add a DeepSeek API key.",
      addProvider: "Add and configure at least one Provider.",
      saved: "Saved. Reopen YouTube Digest to use these settings.",
      saveFailed: "Could not save settings. Please try again.",
      copying: "Copying…",
      promptCopied: "Edited prompt copied.",
      copyFailed:
        "Could not copy the prompt. Select the prompt text and copy it manually.",
      clearedDigests: ({ count }) =>
        `Cleared ${count} cached digest${count === 1 ? "" : "s"}.`,
      notesDeleted: "Deleted all saved notes.",
      resetConfirm:
        "Delete API keys, cached digests, translations, and saved notes from this Chrome profile?",
      allDataDeleted: "All YouTube Digest data was deleted.",
      settingsLoadFailed:
        "Could not load saved settings. You can still preview this page.",
    },
    "zh-CN": {
      pageTitle: "YouTube Digest Settings",
      languageGroupLabel: "界面语言",
      heading: "使用你自己的 API 密钥",
      lede:
        "密钥仅保存在当前 Chrome 个人资料中，只用于 Supadata、你启用的 Provider，以及你主动测试连接的 Provider。本开源扩展没有开发者服务器，也不使用分析服务。",
      transcriptProvider: "字幕服务",
      supadataApiKeyLabel: "Supadata API 密钥",
      supadataHelp: "用于获取带时间戳的 YouTube 字幕。",
      supadataLink: "创建 Supadata 账号并获取密钥",
      supadataHelpSuffix: "。Supadata 会在引导流程中生成密钥。",
      aiProvider: "人工智能服务",
      providerSummaryLabel: "支持的人工智能服务",
      providerBadge: "当前版本支持",
      deepseekApiKeyLabel: "DeepSeek API 密钥",
      deepseekHelp:
        "YouTube Digest 使用 DeepSeek V4 Flash 生成概览、解释内容、翻译字幕和润色笔记。",
      deepseekLink: "创建 DeepSeek API 密钥",
      deepseekHelpSuffix: "。",
      privacyNote:
        "使用人工智能功能时，DeepSeek 会收到视频字幕及相关视频上下文。保存前请查看 DeepSeek 的服务条款和价格。",
      saveSettings: "保存设置",
      localRemix: "本地改造",
      customizationTitle: "想使用其他人工智能模型？",
      customizationPurpose: "编辑并复制一段可安全交给编程助手的提示词",
      agentBadge: "可交给编程助手",
      customizationIntro: "你可以直接编辑提示词。复制前完成以下三步：",
      customizationStepFolder:
        "在编程助手中打开 YouTube Digest 解压后的项目文件夹。",
      customizationStepReplace:
        "把 [PROVIDER] 和 [MODEL] 替换成你想使用的服务和模型。",
      customizationStepKeys:
        "不要在提示词或聊天中加入 API 密钥。代码准备好后，请自行填写。",
      customizationPromptLabel: "可编辑的自定义提示词",
      customizationReminderLabel: "提示词提醒",
      customizationReminder:
        "复制前，请先把 [PROVIDER] 和 [MODEL] 替换成你想使用的服务和模型。",
      customizationPrompt:
        "请把当前本地 YouTube Digest 工作区改为使用 [PROVIDER] 提供的 [MODEL]。只在当前工作区中操作。编辑前，先确认其中包含 manifest.json，且 manifest 中的名称是 YouTube Digest。如果验证失败，请停止，并让我在编程助手中打开 YouTube Digest 解压后的项目文件夹。不要搜索其他文件夹，不要编辑猜测的副本，不要假设安装路径，也不要声称 Chrome 可以显示操作系统中的绝对源码路径。更新该服务的 API 接口地址、请求格式和最少的 Chrome 主机权限。保留用户自带密钥模式和 Chrome 本地存储。不要把 API 密钥写入源代码、提交记录、日志、截图、这段提示词或聊天；代码准备好后，请告诉我应该在哪里自行填写密钥。DeepSeek 专用的请求参数和重试逻辑继续只用于 DeepSeek。新服务的专属规则请单独处理，避免相互影响。更新 README.md、README.zh-CN.md、PRIVACY.md、SECURITY.md 和测试。运行 npm test、npm run check 和 npm run package。最后，说明如何重新加载已解压的扩展，并在真实 YouTube 视频上测试。",
      copyCustomizationPrompt: "复制编辑后的提示词",
      localData: "本地数据",
      localDataHelp:
        "摘要、翻译和笔记仅保存在当前 Chrome 个人资料中。你可以随时删除。",
      clearCache: "清除缓存的摘要",
      deleteNotes: "删除全部笔记",
      resetData: "重置扩展数据",
      footer:
        '完整数据流说明请参阅仓库中的 <a href="PRIVACY.md" target="_blank">PRIVACY.md</a>。',
      migrationWarning:
        "设置已升级为 Provider 卡片。请点击“保存设置”，确认当前 Provider 的域名访问权限；无法识别来源的旧版自定义 Key 不会迁移。",
      saving: "正在保存…",
      addSupadataKey: "请添加 Supadata API 密钥。",
      addDeepseekKey: "请添加 DeepSeek API 密钥。",
      addProvider: "请至少添加并配置一个 Provider。",
      saved: "已保存。请重新打开 YouTube Digest 以使用这些设置。",
      saveFailed: "无法保存设置，请重试。",
      copying: "正在复制…",
      promptCopied: "已复制编辑后的提示词。",
      copyFailed: "无法复制提示词。请选中提示词文本并手动复制。",
      clearedDigests: ({ count }) => `已清除 ${count} 条缓存摘要。`,
      notesDeleted: "已删除全部已保存的笔记。",
      resetConfirm:
        "要从当前 Chrome 个人资料中删除 API 密钥、缓存摘要、翻译和已保存的笔记吗？",
      allDataDeleted: "已删除全部 YouTube Digest 数据。",
      settingsLoadFailed: "无法加载已保存的设置，但你仍可预览此页面。",
    },
  };

  function normalizeLanguage(language) {
    return SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
  }

  function translate(language, key, params = {}) {
    const normalizedLanguage = normalizeLanguage(language);
    const value = COPY[normalizedLanguage][key] ?? COPY.en[key] ?? "";
    return typeof value === "function" ? value(params) : value;
  }

  function createStorageAdapter(chromeApi, fallbackStorage) {
    const chromeStorage = chromeApi?.storage?.local;
    const memoryStorage = new Map();

    function fallbackKeys() {
      const keys = [];
      if (!fallbackStorage) return keys;
      try {
        for (let index = 0; index < fallbackStorage.length; index += 1) {
          const key = fallbackStorage.key(index);
          if (key?.startsWith(PREVIEW_STORAGE_PREFIX)) keys.push(key);
        }
      } catch (_error) {
        return [];
      }
      return keys;
    }

    function readFallbackValue(key) {
      try {
        const rawValue = fallbackStorage?.getItem(
          `${PREVIEW_STORAGE_PREFIX}${key}`,
        );
        if (rawValue !== null && rawValue !== undefined) {
          return JSON.parse(rawValue);
        }
      } catch (_error) {
        // Fall through to memory when localStorage is unavailable or malformed.
      }
      return memoryStorage.get(key);
    }

    function writeFallbackValue(key, value) {
      memoryStorage.set(key, value);
      try {
        fallbackStorage?.setItem(
          `${PREVIEW_STORAGE_PREFIX}${key}`,
          JSON.stringify(value),
        );
      } catch (_error) {
        // The in-memory copy keeps a restricted preview functional.
      }
    }

    return {
      async get(keys) {
        if (chromeStorage) return chromeStorage.get(keys);

        const requestedKeys =
          keys === null
            ? [
                ...new Set([
                  ...memoryStorage.keys(),
                  ...fallbackKeys().map((key) =>
                    key.slice(PREVIEW_STORAGE_PREFIX.length),
                  ),
                ]),
              ]
            : Array.isArray(keys)
              ? keys
              : [keys];

        return Object.fromEntries(
          requestedKeys
            .map((key) => [key, readFallbackValue(key)])
            .filter(([, value]) => value !== undefined),
        );
      },

      async set(items) {
        if (chromeStorage) return chromeStorage.set(items);
        for (const [key, value] of Object.entries(items)) {
          writeFallbackValue(key, value);
        }
      },

      async remove(keys) {
        if (chromeStorage) return chromeStorage.remove(keys);
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          memoryStorage.delete(key);
          try {
            fallbackStorage?.removeItem(`${PREVIEW_STORAGE_PREFIX}${key}`);
          } catch (_error) {
            // Memory removal is sufficient for this preview session.
          }
        }
      },

      async clear() {
        if (chromeStorage) return chromeStorage.clear();
        memoryStorage.clear();
        for (const key of fallbackKeys()) {
          try {
            fallbackStorage.removeItem(key);
          } catch (_error) {
            // Continue clearing any remaining preview keys.
          }
        }
      },
    };
  }

  async function readPreferredLanguage(storage) {
    const stored = await storage.get(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(stored[LANGUAGE_STORAGE_KEY]);
  }

  async function persistPreferredLanguage(storage, language) {
    const normalizedLanguage = normalizeLanguage(language);
    await storage.set({ [LANGUAGE_STORAGE_KEY]: normalizedLanguage });
    return normalizedLanguage;
  }

  function updateLanguageButtonState(buttons, language) {
    const normalizedLanguage = normalizeLanguage(language);
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === normalizedLanguage),
      );
    }
  }

  function updateLocalizedPrompt(textarea, prompt) {
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectionDirection = textarea.selectionDirection;
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;

    textarea.value = prompt;

    if (
      Number.isInteger(selectionStart) &&
      Number.isInteger(selectionEnd) &&
      typeof textarea.setSelectionRange === "function"
    ) {
      textarea.setSelectionRange(
        Math.min(selectionStart, prompt.length),
        Math.min(selectionEnd, prompt.length),
        selectionDirection || "none",
      );
    }
    textarea.scrollTop = scrollTop;
    textarea.scrollLeft = scrollLeft;
  }

  function createPromptDrafts() {
    return {
      en: translate("en", "customizationPrompt"),
      "zh-CN": translate("zh-CN", "customizationPrompt"),
    };
  }

  function switchPromptDraft(
    drafts,
    currentLanguage,
    nextLanguage,
    currentValue,
  ) {
    const normalizedCurrentLanguage = normalizeLanguage(currentLanguage);
    const normalizedNextLanguage = normalizeLanguage(nextLanguage);
    drafts[normalizedCurrentLanguage] = String(currentValue ?? "");
    if (typeof drafts[normalizedNextLanguage] !== "string") {
      drafts[normalizedNextLanguage] = translate(
        normalizedNextLanguage,
        "customizationPrompt",
      );
    }
    return {
      language: normalizedNextLanguage,
      prompt: drafts[normalizedNextLanguage],
    };
  }

  async function copyPromptValue(clipboard, value) {
    await clipboard.writeText(value);
  }

  function getSafeLocalStorage(root) {
    try {
      return root.localStorage;
    } catch (_error) {
      return null;
    }
  }

  function createProviderId(type = "provider", cryptoApi = globalThis.crypto) {
    if (typeof cryptoApi?.randomUUID === "function") {
      return `${type}-${cryptoApi.randomUUID()}`;
    }
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createProviderFromPreset(
    presetKey,
    cryptoApi = globalThis.crypto,
  ) {
    const preset = PROVIDER_PRESETS[presetKey] || PROVIDER_PRESETS.custom;
    return {
      id: createProviderId(preset.type, cryptoApi),
      type: preset.type,
      name: preset.name,
      baseUrl: preset.baseUrl,
      model: preset.model,
      apiKey: "",
    };
  }

  function normalizeProvider(provider, cryptoApi = globalThis.crypto) {
    const preset =
      Object.values(PROVIDER_PRESETS).find(
        (candidate) => candidate.type === provider?.type,
      ) || PROVIDER_PRESETS.custom;
    const type = preset.type;
    return {
      id:
        typeof provider?.id === "string" && provider.id.trim()
          ? provider.id.trim().replace(/[^A-Za-z0-9_-]/g, "") ||
            createProviderId(type, cryptoApi)
          : createProviderId(type, cryptoApi),
      type,
      name:
        typeof provider?.name === "string" && provider.name.trim()
          ? provider.name.trim()
          : preset.name,
      baseUrl:
        typeof provider?.baseUrl === "string"
          ? provider.baseUrl.trim().replace(/\/+$/, "")
          : preset.baseUrl,
      model:
        typeof provider?.model === "string"
          ? provider.model.trim()
          : preset.model,
      apiKey:
        typeof provider?.apiKey === "string" ? provider.apiKey.trim() : "",
    };
  }

  function normalizeProviderSettings(input = {}, cryptoApi = globalThis.crypto) {
    let providers = Array.isArray(input.providers)
      ? input.providers.map((provider) => normalizeProvider(provider, cryptoApi))
      : [];
    if (!providers.length) {
      const legacyProvider = createProviderFromPreset("deepseek", cryptoApi);
      legacyProvider.apiKey =
        typeof input.aiApiKey === "string" ? input.aiApiKey.trim() : "";
      legacyProvider.baseUrl =
        typeof input.aiBaseUrl === "string" && input.aiBaseUrl.trim()
          ? input.aiBaseUrl.trim().replace(/\/+$/, "")
          : legacyProvider.baseUrl;
      legacyProvider.model =
        typeof input.aiModel === "string" && input.aiModel.trim()
          ? input.aiModel.trim()
          : legacyProvider.model;
      providers = [legacyProvider];
    }
    const seenIds = new Set();
    providers = providers.map((provider) => {
      if (!seenIds.has(provider.id)) {
        seenIds.add(provider.id);
        return provider;
      }
      const replacement = { ...provider, id: createProviderId(provider.type, cryptoApi) };
      seenIds.add(replacement.id);
      return replacement;
    });
    const requestedActiveId = String(input.activeProviderId || "").trim();
    return {
      schemaVersion: PROVIDER_SCHEMA_VERSION,
      supadataApiKey:
        typeof input.supadataApiKey === "string"
          ? input.supadataApiKey.trim()
          : "",
      providers,
      activeProviderId: providers.some(
        (provider) => provider.id === requestedActiveId,
      )
        ? requestedActiveId
        : providers[0]?.id || "",
    };
  }

  function validateProviderForUi(settingsApi, provider) {
    const normalized = normalizeProvider(provider);
    if (typeof settingsApi?.validateProvider === "function") {
      const result = settingsApi.validateProvider(normalized);
      if (result === false || result?.valid === false) {
        throw new Error(
          result?.message ||
            result?.error ||
            result?.errors?.[0] ||
            "Provider 配置无效。",
        );
      }
      return result?.provider || normalized;
    }
    if (!normalized.name) throw new Error("请填写 Provider 名称。");
    if (!normalized.baseUrl) throw new Error("请填写 API 地址。");
    let parsedUrl;
    try {
      parsedUrl = new URL(normalized.baseUrl);
    } catch (_error) {
      throw new Error("API 地址格式无效。");
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error("API 地址必须使用 HTTPS。");
    }
    if (!normalized.model) throw new Error("请填写模型名称。");
    if (!normalized.apiKey) throw new Error("请填写 API Key。");
    return normalized;
  }

  async function requestProviderOriginPermission(root, provider) {
    const permissions = root.chrome?.permissions;
    if (!permissions?.request) return true;
    let origin;
    try {
      origin = `${new URL(provider.baseUrl).origin}/*`;
    } catch (_error) {
      return false;
    }
    return permissions.request({ origins: [origin] });
  }

  function buildPersistedSettings(settingsApi, draft) {
    const normalizedDraft = normalizeProviderSettings(draft);
    if (typeof settingsApi?.normalize !== "function") return normalizedDraft;
    const normalizedBySettings = settingsApi.normalize(normalizedDraft);
    return Array.isArray(normalizedBySettings?.providers)
      ? normalizedBySettings
      : normalizedDraft;
  }

  function initialize(root = globalThis) {
    const doc = root.document;
    const settingsApi = root.YTD_SETTINGS;
    if (!doc || !settingsApi) return;

    const storage = createStorageAdapter(
      root.chrome,
      getSafeLocalStorage(root),
    );
    const form = doc.getElementById("settingsForm");
    const supadataApiKeyInput = doc.getElementById("supadataApiKey");
    const providerList = doc.getElementById("providerList");
    const providerEmptyState = doc.getElementById("providerEmptyState");
    const providerCardTemplate = doc.getElementById("providerCardTemplate");
    const providerAddMenu = doc.getElementById("providerAddMenu");
    const customizationPrompt = doc.getElementById("customizationPrompt");
    const copyCustomizationPromptBtn = doc.getElementById(
      "copyCustomizationPromptBtn",
    );
    const copyStatus = doc.getElementById("copyStatus");
    const saveStatus = doc.getElementById("saveStatus");
    const dataStatus = doc.getElementById("dataStatus");
    const statusStates = new Map();
    const promptDrafts = createPromptDrafts();
    let currentLanguage = DEFAULT_LANGUAGE;
    let providerSettings = normalizeProviderSettings();

    function renderStatus(element) {
      const state = statusStates.get(element);
      element.textContent = state
        ? translate(currentLanguage, state.key, state.params)
        : "";
    }

    function setStatus(element, key, params = {}) {
      statusStates.set(element, { key, params });
      renderStatus(element);
    }

    function setProviderStatus(element, message, state = "") {
      element.textContent = message;
      element.dataset.state = state;
    }

    function findProvider(providerId) {
      return providerSettings.providers.find(
        (provider) => provider.id === providerId,
      );
    }

    function updateProviderField(providerId, field, value) {
      const provider = findProvider(providerId);
      if (!provider) return;
      provider[field] = value;
    }

    async function persistProviderSettings({ validateAll = true } = {}) {
      providerSettings.supadataApiKey = supadataApiKeyInput.value.trim();
      if (validateAll) {
        providerSettings.providers = providerSettings.providers.map((provider) =>
          validateProviderForUi(settingsApi, provider),
        );
      }
      const activeProvider = findProvider(providerSettings.activeProviderId);
      if (!activeProvider) throw new Error("请先启用一个 Provider。");
      const permissionGranted = await requestProviderOriginPermission(
        root,
        activeProvider,
      );
      if (!permissionGranted) {
        throw new Error("未获得当前 Provider 域名的访问权限。");
      }
      const settings = buildPersistedSettings(settingsApi, providerSettings);
      await storage.set({ [settingsApi.STORAGE_KEY]: settings });
      providerSettings = normalizeProviderSettings(settings);
      return settings;
    }

    function renderProviders() {
      providerList.innerHTML = "";
      providerEmptyState.hidden = providerSettings.providers.length > 0;
      for (const provider of providerSettings.providers) {
        const fragment = providerCardTemplate.content.cloneNode(true);
        const card = fragment.querySelector(".provider-card");
        const body = fragment.querySelector(".provider-card-body");
        const status = fragment.querySelector(".provider-status");
        const isActive = provider.id === providerSettings.activeProviderId;
        card.dataset.providerId = provider.id;
        card.classList.toggle("active", isActive);
        fragment.querySelector(".provider-card-title").textContent = provider.name;
        fragment.querySelector(".provider-type").textContent =
          `${provider.type === "custom-openai" ? "OpenAI 兼容" : provider.type} Provider`;
        fragment.querySelector(".provider-icon").textContent =
          provider.name.trim().slice(0, 1).toUpperCase();
        fragment.querySelector(".provider-active-badge").hidden = !isActive;

        const nameInput = fragment.querySelector(".provider-name-input");
        const modelInput = fragment.querySelector(".provider-model-input");
        const urlInput = fragment.querySelector(".provider-url-input");
        const keyInput = fragment.querySelector(".provider-key-input");
        nameInput.value = provider.name;
        modelInput.value = provider.model;
        urlInput.value = provider.baseUrl;
        keyInput.value = provider.apiKey;
        for (const [input, field] of [
          [nameInput, "name"],
          [modelInput, "model"],
          [urlInput, "baseUrl"],
          [keyInput, "apiKey"],
        ]) {
          input.addEventListener("input", () => {
            updateProviderField(provider.id, field, input.value);
            if (field === "name") {
              card.querySelector(".provider-card-title").textContent =
                input.value.trim() || "未命名 Provider";
            }
          });
        }

        const secretToggle = fragment.querySelector(".secret-toggle");
        secretToggle.addEventListener("click", () => {
          const reveal = keyInput.type === "password";
          keyInput.type = reveal ? "text" : "password";
          secretToggle.textContent = reveal ? "隐藏" : "显示";
          secretToggle.setAttribute("aria-pressed", String(reveal));
        });

        const expandButton = fragment.querySelector(".provider-expand");
        expandButton.addEventListener("click", () => {
          const expanded = expandButton.getAttribute("aria-expanded") === "true";
          expandButton.setAttribute("aria-expanded", String(!expanded));
          expandButton.textContent = expanded ? "展开" : "收起";
          body.hidden = expanded;
        });

        const testButton = fragment.querySelector(".provider-test");
        testButton.addEventListener("click", async () => {
          let candidate;
          try {
            candidate = validateProviderForUi(settingsApi, provider);
          } catch (error) {
            setProviderStatus(status, error.message, "error");
            return;
          }
          testButton.disabled = true;
          setProviderStatus(status, "正在测试连接……", "loading");
          try {
            const permissionGranted = await requestProviderOriginPermission(
              root,
              candidate,
            );
            if (!permissionGranted) {
              throw new Error("未获得该 Provider 域名的访问权限。");
            }
            const result = await root.chrome.runtime.sendMessage({
              action: "TEST_PROVIDER_CONNECTION",
              provider: candidate,
            });
            if (result?.success) {
              setProviderStatus(
                status,
                `${result.providerName || candidate.name} 连接成功。`,
                "success",
              );
            } else {
              setProviderStatus(
                status,
                result?.message || result?.error || "连接失败，请检查配置。",
                "error",
              );
            }
          } catch (error) {
            setProviderStatus(
              status,
              error.message || "连接失败，请稍后重试。",
              "error",
            );
          } finally {
            testButton.disabled = false;
          }
        });

        const enableButton = fragment.querySelector(".provider-enable");
        enableButton.disabled = isActive;
        enableButton.textContent = isActive ? "已启用" : "启用";
        enableButton.addEventListener("click", async () => {
          const previousActiveProviderId = providerSettings.activeProviderId;
          try {
            validateProviderForUi(settingsApi, provider);
            providerSettings.activeProviderId = provider.id;
            enableButton.disabled = true;
            await persistProviderSettings({ validateAll: false });
            setStatus(saveStatus, "saved");
            renderProviders();
          } catch (error) {
            providerSettings.activeProviderId = previousActiveProviderId;
            enableButton.disabled = false;
            setProviderStatus(status, error.message, "error");
          }
        });

        const deleteButton = fragment.querySelector(".provider-delete");
        deleteButton.disabled = providerSettings.providers.length <= 1;
        deleteButton.addEventListener("click", async () => {
          if (providerSettings.providers.length <= 1) {
            setProviderStatus(status, "至少需要保留一个 Provider。", "error");
            return;
          }
          if (!root.confirm(`确定删除 ${provider.name} 吗？`)) return;
          const previousProviders = providerSettings.providers;
          const previousActiveProviderId = providerSettings.activeProviderId;
          providerSettings.providers = providerSettings.providers.filter(
            (item) => item.id !== provider.id,
          );
          if (providerSettings.activeProviderId === provider.id) {
            providerSettings.activeProviderId = providerSettings.providers[0].id;
          }
          try {
            deleteButton.disabled = true;
            await persistProviderSettings({ validateAll: false });
            setStatus(saveStatus, "saved");
            renderProviders();
          } catch (error) {
            providerSettings.providers = previousProviders;
            providerSettings.activeProviderId = previousActiveProviderId;
            deleteButton.disabled = false;
            setProviderStatus(status, error.message, "error");
          }
        });

        providerList.appendChild(fragment);
      }
    }

    function applyLanguage(language) {
      const nextDraft = switchPromptDraft(
        promptDrafts,
        currentLanguage,
        language,
        customizationPrompt.value,
      );
      currentLanguage = nextDraft.language;
      doc.documentElement.lang = currentLanguage;
      doc.title = translate(currentLanguage, "pageTitle");

      for (const element of doc.querySelectorAll("[data-i18n]")) {
        element.textContent = translate(
          currentLanguage,
          element.dataset.i18n,
        );
      }
      for (const element of doc.querySelectorAll("[data-i18n-html]")) {
        element.innerHTML = translate(
          currentLanguage,
          element.dataset.i18nHtml,
        );
      }
      for (const element of doc.querySelectorAll("[data-i18n-aria-label]")) {
        element.setAttribute(
          "aria-label",
          translate(currentLanguage, element.dataset.i18nAriaLabel),
        );
      }

      updateLocalizedPrompt(
        customizationPrompt,
        nextDraft.prompt,
      );
      for (const element of statusStates.keys()) renderStatus(element);
    }

    async function loadSettings() {
      try {
        const stored = await storage.get(settingsApi.STORAGE_KEY);
        const rawSettings = stored[settingsApi.STORAGE_KEY] || {};
        const migration = typeof settingsApi.migrateLegacyCustom === "function"
          ? settingsApi.migrateLegacyCustom(rawSettings)
          : { settings: rawSettings, migrated: false };
        const sourceSettings = Array.isArray(rawSettings.providers)
          ? rawSettings
          : migration.settings;
        providerSettings = normalizeProviderSettings(sourceSettings);
        supadataApiKeyInput.value = providerSettings.supadataApiKey;
        renderProviders();
        if (migration.migrated || !Array.isArray(rawSettings.providers)) {
          await storage.set({
            [settingsApi.STORAGE_KEY]: buildPersistedSettings(
              settingsApi,
              providerSettings,
            ),
          });
          setStatus(saveStatus, "migrationWarning");
        }
      } catch (_error) {
        setStatus(saveStatus, "settingsLoadFailed");
        renderProviders();
      }
    }

    async function loadOptions() {
      applyLanguage(DEFAULT_LANGUAGE);
      await loadSettings();
    }

    async function saveSettings(event) {
      event.preventDefault();
      setStatus(saveStatus, "saving");

      if (!supadataApiKeyInput.value.trim()) {
        setStatus(saveStatus, "addSupadataKey");
        return;
      }
      if (!providerSettings.providers.length) {
        setStatus(saveStatus, "addProvider");
        return;
      }

      try {
        await persistProviderSettings();
        setStatus(saveStatus, "saved");
        renderProviders();
      } catch (_error) {
        statusStates.delete(saveStatus);
        saveStatus.textContent = _error.message || translate(
          currentLanguage,
          "saveFailed",
        );
      }
    }

    async function copyCustomizationPrompt() {
      setStatus(copyStatus, "copying");
      try {
        await copyPromptValue(
          root.navigator.clipboard,
          customizationPrompt.value,
        );
        setStatus(copyStatus, "promptCopied");
      } catch (_error) {
        setStatus(copyStatus, "copyFailed");
      }
    }

    async function clearCachedDigests() {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter((key) => key.startsWith("digest_"));
      if (keys.length) await storage.remove(keys);
      setStatus(dataStatus, "clearedDigests", { count: keys.length });
    }

    async function clearNotes() {
      await storage.remove("ytd_notes");
      setStatus(dataStatus, "notesDeleted");
    }

    async function resetAllData() {
      const confirmed = root.confirm(
        translate(currentLanguage, "resetConfirm"),
      );
      if (!confirmed) return;

      await storage.clear();
      await persistPreferredLanguage(storage, currentLanguage);
      await loadSettings();
      setStatus(dataStatus, "allDataDeleted");
    }

    form.addEventListener("submit", saveSettings);
    providerAddMenu
      .querySelectorAll("[data-provider-preset]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const provider = createProviderFromPreset(
            button.dataset.providerPreset,
            root.crypto,
          );
          providerSettings.providers.push(provider);
          if (!providerSettings.activeProviderId) {
            providerSettings.activeProviderId = provider.id;
          }
          providerAddMenu.open = false;
          renderProviders();
          Array.from(providerList.querySelectorAll(".provider-card"))
            .find((card) => card.dataset.providerId === provider.id)
            ?.querySelector("input")
            ?.focus();
        });
      });
    copyCustomizationPromptBtn.addEventListener(
      "click",
      copyCustomizationPrompt,
    );
    doc
      .getElementById("clearCacheBtn")
      .addEventListener("click", clearCachedDigests);
    doc.getElementById("clearNotesBtn").addEventListener("click", clearNotes);
    doc.getElementById("resetBtn").addEventListener("click", resetAllData);
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", loadOptions, { once: true });
    } else {
      void loadOptions();
    }
  }

  return {
    COPY,
    LANGUAGE_STORAGE_KEY,
    PROVIDER_PRESETS,
    PROVIDER_SCHEMA_VERSION,
    buildPersistedSettings,
    copyPromptValue,
    createProviderFromPreset,
    createPromptDrafts,
    createStorageAdapter,
    normalizeLanguage,
    normalizeProvider,
    normalizeProviderSettings,
    persistPreferredLanguage,
    readPreferredLanguage,
    requestProviderOriginPermission,
    translate,
    updateLanguageButtonState,
    updateLocalizedPrompt,
    validateProviderForUi,
    switchPromptDraft,
    initialize,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_OPTIONS;
}

if (typeof document !== "undefined") {
  YTD_OPTIONS.initialize();
}
