const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const ALLOWED_VISIBLE_ENGLISH = new Set([
  "API",
  "Chrome",
  "Copy",
  "DeepSeek",
  "Digest",
  "Enter",
  "Flash",
  "MODEL",
  "Notes",
  "Original",
  "Overview",
  "PRIVACY.md",
  "PROVIDER",
  "Settings",
  "Shift",
  "Supadata",
  "Transcript",
  "V4",
  "YouTube",
  "n",
]);

function visibleHtmlCopy(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    // The customization textarea is a developer prompt, not ordinary UI copy.
    .replace(/<textarea\b[\s\S]*?<\/textarea>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:times|nbsp);|&#\d+;/g, " ");
}

function userFacingAttributes(html) {
  return [
    ...html.matchAll(
      /(?<!data-i18n-)(?:aria-label|title|placeholder)="([^"]+)"/g,
    ),
  ]
    .map((match) => match[1])
    .join(" ");
}

function unexpectedEnglish(copy) {
  return [...copy.matchAll(/[A-Za-z][A-Za-z0-9_.-]*/g)]
    .map((match) => match[0])
    .filter((word) => !ALLOWED_VISIBLE_ENGLISH.has(word));
}

test("static product UI uses Chinese except for the approved English whitelist", () => {
  for (const file of ["sidepanel.html", "options.html"]) {
    const html = read(file);
    const uiCopy = `${visibleHtmlCopy(html)} ${userFacingAttributes(html)}`;
    assert.deepEqual(
      [...new Set(unexpectedEnglish(uiCopy))],
      [],
      `${file} contains unexpected user-visible English`,
    );
  }
});

test("side panel keeps approved navigation labels and localizes controls", () => {
  const html = read("sidepanel.html");

  for (const label of ["Settings", "Transcript", "Overview", "Notes"]) {
    assert.match(html, new RegExp(`>\\s*${label}\\s*</`));
  }
  for (const surface of ["transcript", "overview", "notes"]) {
    const control = html.match(
      new RegExp(`data-language-surface="${surface}"([\\s\\S]*?)<\\/div>`),
    );
    assert.ok(control, `Missing ${surface} language control`);
    assert.match(control[0], />Original<\/button>/);
    assert.match(control[0], />中文<\/button>/);
    assert.match(control[0], />双语<\/button>/);
  }

  assert.match(html, /id="copyTranscriptBtn">Copy<\/button>/);
  assert.match(html, /id="exportTranscriptBtn">[\s\S]*导出/);
  assert.match(html, /id="notesFilterThis"[\s\S]*当前视频/);
  assert.match(html, /id="notesFilterAll"[\s\S]*全部笔记/);
  assert.match(html, /id="followPlaybackBtn"[\s\S]*跟随播放进度/);
});

test("runtime user actions and feedback use Chinese copy", () => {
  const sidepanel = read("sidepanel.js");
  const content = read("content.js");

  for (const copy of [
    "正在保存……",
    "已保存",
    "保存笔记失败，请重试。",
    "已复制",
    "删除笔记",
    "复制文本",
    "复制时间点",
    "正在加载笔记……",
    "无法获取解释，请稍后重试。",
    "正在重试……",
  ]) {
    assert.ok(sidepanel.includes(copy), `Missing localized runtime copy: ${copy}`);
  }

  assert.match(content, /setAttribute\("aria-label", "打开 YouTube Digest"\)/);
  assert.match(
    content,
    /setAttribute\("aria-label", "保存当前时刻为笔记（快捷键 N）"\)/,
  );
  assert.match(content, /ytd-digest-label">摘要<\/span>/);
});
