/** Provider protocol adapters for the common YouTube Digest AI request shape. */
var YTD_AI_PROVIDERS = (() => {
  function requireProvider(provider) {
    const validation = YTD_SETTINGS.validateProvider(provider);
    if (!validation.valid) {
      const error = new Error(validation.errors[0]);
      error.code = validation.provider.apiKey ? "INVALID_PROVIDER" : "NO_AI_KEY";
      throw error;
    }
    return validation.provider;
  }

  function splitSystemMessages(messages) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => String(message.content || ""))
      .filter(Boolean)
      .join("\n\n");
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || ""),
      }));
    return { system, conversation };
  }

  function buildOpenAiRequest(provider, options) {
    const body = { model: provider.model, messages: options.messages };
    if (provider.type === "openai" || provider.type === "mimo") {
      body.max_completion_tokens = options.maxTokens;
    } else {
      body.max_tokens = options.maxTokens;
    }
    if (typeof options.temperature === "number") body.temperature = options.temperature;
    if (options.responseFormat) body.response_format = options.responseFormat;
    if (provider.type === "deepseek" || provider.type === "mimo") {
      body.thinking = { type: "disabled" };
    }
    return {
      url: YTD_SETTINGS.endpointUrl(provider),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body,
    };
  }

  function buildAnthropicRequest(provider, options) {
    const { system, conversation } = splitSystemMessages(options.messages);
    const body = { model: provider.model, max_tokens: options.maxTokens, messages: conversation };
    if (system) body.system = system;
    if (typeof options.temperature === "number") body.temperature = options.temperature;
    return {
      url: YTD_SETTINGS.endpointUrl(provider),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
    };
  }

  function buildGeminiRequest(provider, options) {
    const { system, conversation } = splitSystemMessages(options.messages);
    const body = {
      contents: conversation.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: options.maxTokens },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (typeof options.temperature === "number") body.generationConfig.temperature = options.temperature;
    if (options.responseFormat) body.generationConfig.responseMimeType = "application/json";
    return {
      url: YTD_SETTINGS.endpointUrl(provider),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey,
      },
      body,
    };
  }

  function buildProviderRequest(providerInput, options = {}) {
    const provider = requireProvider(providerInput);
    const normalizedOptions = {
      messages: Array.isArray(options.messages) ? options.messages : [],
      maxTokens: Number.isFinite(options.maxTokens) ? options.maxTokens : 1024,
      temperature: options.temperature,
      responseFormat: options.responseFormat,
    };
    if (provider.type === "anthropic") return buildAnthropicRequest(provider, normalizedOptions);
    if (provider.type === "gemini") return buildGeminiRequest(provider, normalizedOptions);
    return buildOpenAiRequest(provider, normalizedOptions);
  }

  function parseProviderResponse(providerInput, data) {
    const provider = YTD_SETTINGS.normalizeProvider(providerInput);
    let text = "";
    if (provider.type === "anthropic") {
      text = Array.isArray(data?.content)
        ? data.content.filter((block) => block?.type === "text").map((block) => block.text || "").join("")
        : "";
    } else if (provider.type === "gemini") {
      text = Array.isArray(data?.candidates?.[0]?.content?.parts)
        ? data.candidates[0].content.parts.map((part) => part?.text || "").join("")
        : "";
    } else {
      text = data?.choices?.[0]?.message?.content;
    }
    if (typeof text !== "string" || !text.trim()) {
      const error = new Error(`${provider.name} 返回了空内容，请重试。`);
      error.code = "EMPTY_AI_RESPONSE";
      error.providerName = provider.name;
      throw error;
    }
    return text;
  }

  return { buildProviderRequest, parseProviderResponse };
})();

if (typeof module !== "undefined" && module.exports) {
  globalThis.YTD_SETTINGS ||= require("./settings.js");
  module.exports = YTD_AI_PROVIDERS;
}
