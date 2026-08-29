const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const options = require("../options.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Settings is a fixed Simplified Chinese interface", () => {
  const html = read("options.html");

  assert.match(html, /^<html lang="zh-CN">/m);
  assert.equal(options.normalizeLanguage("unsupported"), "zh-CN");
  assert.equal(options.translate("zh-CN", "pageTitle"), "YouTube Digest Settings");
  assert.equal(options.translate("zh-CN", "saveSettings"), "保存设置");
  assert.equal(
    options.translate("zh-CN", "clearedDigests", { count: 2 }),
    "已清除 2 条缓存摘要。",
  );

  const referencedKeys = [
    ...html.matchAll(/data-i18n(?:-html|-aria-label)?="([^"]+)"/g),
  ].map((match) => match[1]);
  for (const key of referencedKeys) {
    assert.ok(options.COPY["zh-CN"][key], `Missing Chinese copy for ${key}`);
  }

  assert.doesNotMatch(html, /class="language-switch"/);
  assert.doesNotMatch(html, /data-language=/);
  assert.doesNotMatch(html, />\s*English\s*</);
  assert.doesNotMatch(html, /Interface language/);
  assert.doesNotMatch(JSON.stringify(options.COPY["zh-CN"]), /—/);
  assert.doesNotMatch(html, /—/);
});

test("Settings placeholders and primary actions are Chinese", () => {
  const html = read("options.html");

  assert.match(html, /placeholder="粘贴你的 Supadata 密钥"/);
  assert.match(html, /placeholder="粘贴你的 DeepSeek 密钥"/);
  assert.match(html, /data-i18n="saveSettings">[\s\S]*保存设置/);
  assert.match(html, /data-i18n="clearCache">[\s\S]*清除缓存的摘要/);
  assert.match(html, /data-i18n="deleteNotes">[\s\S]*删除全部笔记/);
  assert.match(html, /data-i18n="resetData"[\s\S]*重置扩展数据/);
});

test("customization guidance is concise and has a visible placeholder reminder", () => {
  const html = read("options.html");
  const steps = html.match(
    /<ol class="customization-steps">([\s\S]*?)<\/ol>/,
  );

  assert.ok(steps, "Expected a numbered customization guide");
  assert.equal((steps[1].match(/<li\b/g) || []).length, 3);
  assert.match(html, /class="prompt-reminder"/);
  assert.match(html, /role="note"/);
  assert.equal(
    options.translate("zh-CN", "customizationReminder"),
    "复制前，请先把 [PROVIDER] 和 [MODEL] 替换成你想使用的服务和模型。",
  );
  assert.equal(
    options.translate("zh-CN", "customizationStepFolder"),
    "在编程助手中打开 YouTube Digest 解压后的项目文件夹。",
  );
  assert.doesNotMatch(html, /~\/Documents\/youtube-digest/);
  assert.doesNotMatch(html, /%USERPROFILE%\\Documents\\youtube-digest/);
});

test("customization prompt stays Chinese and preserves technical values", () => {
  const html = read("options.html");
  const chinesePrompt = options.translate("zh-CN", "customizationPrompt");

  assert.match(html, /https:\/\/dash\.supadata\.ai\/auth\/sign-up/);
  assert.match(html, /https:\/\/platform\.deepseek\.com\/api_keys/);
  assert.ok(html.includes(`>${chinesePrompt}</textarea>`));
  assert.match(chinesePrompt, /^请把当前本地 YouTube Digest 工作区改为使用/);
  assert.match(
    chinesePrompt,
    /DeepSeek 专用的请求参数和重试逻辑继续只用于 DeepSeek。新服务的专属规则请单独处理，避免相互影响。/,
  );

  for (const value of [
    "[PROVIDER]",
    "[MODEL]",
    "manifest.json",
    "README.md",
    "README.zh-CN.md",
    "PRIVACY.md",
    "SECURITY.md",
    "npm test",
    "npm run check",
    "npm run package",
  ]) {
    assert.ok(chinesePrompt.includes(value), `Missing technical value: ${value}`);
  }
  assert.doesNotMatch(chinesePrompt, /—/);

  const textareaTag = html.match(/<textarea id="customizationPrompt"[^>]*>/);
  assert.ok(textareaTag, "Expected the customization prompt textarea");
  assert.doesNotMatch(textareaTag[0], /\sreadonly(?:\s|=|>)/);
  assert.match(
    textareaTag[0],
    /aria-describedby="customizationPromptReminder"/,
  );
  assert.doesNotMatch(html, /<textarea id="customizationPrompt"[^>]*data-i18n/);
});

test("copy helper writes the current edited textarea value", async () => {
  const writes = [];
  const clipboard = {
    async writeText(value) {
      writes.push(value);
    },
  };

  await options.copyPromptValue(
    clipboard,
    "我编辑的 [PROVIDER] 和 [MODEL] 提示词",
  );

  assert.deepEqual(writes, ["我编辑的 [PROVIDER] 和 [MODEL] 提示词"]);
});

test("localized prompt updates preserve the textarea selection and scroll", () => {
  const textarea = {
    value: options.translate("zh-CN", "customizationPrompt"),
    selectionStart: 12,
    selectionEnd: 48,
    selectionDirection: "forward",
    scrollTop: 90,
    scrollLeft: 7,
    setSelectionRange(start, end, direction) {
      this.selectionStart = start;
      this.selectionEnd = end;
      this.selectionDirection = direction;
    },
  };
  const chinesePrompt = `${textarea.value}\n补充要求`;

  options.updateLocalizedPrompt(textarea, chinesePrompt);

  assert.equal(textarea.value, chinesePrompt);
  assert.equal(textarea.selectionStart, 12);
  assert.equal(textarea.selectionEnd, 48);
  assert.equal(textarea.selectionDirection, "forward");
  assert.equal(textarea.scrollTop, 90);
  assert.equal(textarea.scrollLeft, 7);
});
