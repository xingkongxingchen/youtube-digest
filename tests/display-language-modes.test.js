const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createElement() {
  let html = "";
  let text = "";
  return {
    dataset: {},
    style: {},
    className: "",
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    set textContent(value) {
      text = String(value);
      html = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    },
    get textContent() { return text; },
    set innerHTML(value) { html = String(value); },
    get innerHTML() { return html; },
    appendChild() {},
    remove() {},
    addEventListener() {},
    setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function loadHarness({
  storageSeed = {},
  sendMessage = () => Promise.resolve({}),
} = {}) {
  const localStorage = { ...storageSeed };
  const sessionStorage = {};
  const elements = new Map();
  let activeTab = "transcript";
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const listeners = { addListener() {} };
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval() {},
    clearInterval() {},
    requestAnimationFrame(callback) { callback(); },
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    CSS: { escape: (value) => value },
    navigator: { clipboard: { writeText: async () => {} } },
    window: { getSelection: () => null, close() {} },
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === ".tab.active") return { dataset: { tab: activeTab } };
        const panel = selector.match(/^\.tab-panel\[data-panel="([^"]+)"\]\.active$/);
        return panel?.[1] === activeTab ? element(`${activeTab}Panel`) : null;
      },
      querySelectorAll() { return []; },
      getElementById(id) { return element(id); },
      createElement,
    },
    chrome: {
      runtime: { onMessage: listeners, sendMessage },
      storage: {
        local: {
          async get(keys) {
            if (keys === null) return { ...localStorage };
            if (Array.isArray(keys)) {
              return Object.fromEntries(keys.map((key) => [key, localStorage[key]]));
            }
            return { [keys]: localStorage[keys] };
          },
          async set(values) { Object.assign(localStorage, values); },
          async remove(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete localStorage[key];
          },
        },
        session: {
          async get(key) { return { [key]: sessionStorage[key] }; },
          async set(values) { Object.assign(sessionStorage, values); },
        },
      },
      windows: { getCurrent: async () => ({ id: 1 }) },
      tabs: {
        onUpdated: listeners,
        onActivated: listeners,
        sendMessage: async () => ({}),
      },
    },
    YTD_SETTINGS: {},
  };
  sandbox.globalThis = sandbox;

  const instrumentation = `
    globalThis.__YTD_STATE_TESTING__ = {
      setState(next) {
        if (Object.hasOwn(next, "currentVideoId")) currentVideoId = next.currentVideoId;
        if (Object.hasOwn(next, "currentAnalysis")) currentAnalysis = next.currentAnalysis;
        if (Object.hasOwn(next, "currentTranscript")) currentTranscript = next.currentTranscript;
        if (Object.hasOwn(next, "currentTranscriptTimestamped")) currentTranscriptTimestamped = next.currentTranscriptTimestamped;
        if (Object.hasOwn(next, "currentVideoTitle")) currentVideoTitle = next.currentVideoTitle;
        if (Object.hasOwn(next, "isAnalysisLoading")) isAnalysisLoading = next.isAnalysisLoading;
        if (Object.hasOwn(next, "analysisGeneration")) analysisGeneration = next.analysisGeneration;
        if (Object.hasOwn(next, "notesRequestGeneration")) notesRequestGeneration = next.notesRequestGeneration;
        if (Object.hasOwn(next, "currentNotes")) currentNotes = next.currentNotes;
        if (Object.hasOwn(next, "currentNotesFilterVideoId")) currentNotesFilterVideoId = next.currentNotesFilterVideoId;
        if (Object.hasOwn(next, "currentNotesOwnerVideoId")) currentNotesOwnerVideoId = next.currentNotesOwnerVideoId;
        if (Object.hasOwn(next, "currentNotesAreLoaded")) currentNotesAreLoaded = next.currentNotesAreLoaded;
        if (Object.hasOwn(next, "modes")) {
          currentDisplayLanguageModes = { ...currentDisplayLanguageModes, ...next.modes };
          currentTranscriptMode = currentDisplayLanguageModes.transcript;
        }
        if (Object.hasOwn(next, "translationGeneration")) translationGeneration = next.translationGeneration;
        if (Object.hasOwn(next, "interfaceTranslationGenerations")) {
          interfaceTranslationGenerations = { ...interfaceTranslationGenerations, ...next.interfaceTranslationGenerations };
        }
      },
      setWorkers(next) {
        if (next.translateTranscript) translateTranscript = next.translateTranscript;
        if (next.translateOverviewContent) translateOverviewContent = next.translateOverviewContent;
        if (next.translateNotesContent) translateNotesContent = next.translateNotesContent;
        if (next.triggerAnalysis) triggerAnalysis = next.triggerAnalysis;
        if (next.renderAnalysisResults) renderAnalysisResults = next.renderAnalysisResults;
        if (next.renderNotes) renderNotes = next.renderNotes;
        if (next.highlightMomentsOnPage) highlightMomentsOnPage = next.highlightMomentsOnPage;
        if (next.saveToCache) saveToCache = next.saveToCache;
      },
      snapshot() {
        return {
          currentVideoId,
          currentAnalysis,
          isAnalysisLoading,
          currentNotes,
          currentNotesFilterVideoId,
          currentNotesOwnerVideoId,
          currentNotesAreLoaded,
          modes: { ...currentDisplayLanguageModes },
          translationGeneration,
          interfaceTranslationGenerations: { ...interfaceTranslationGenerations },
          translationWorkCounts: { ...translationWorkCounts },
          cache: [...interfaceTranslationCache.entries()],
          failures: [...interfaceTranslationFailures.entries()],
          inFlight: [...interfaceTranslationInFlight.entries()],
        };
      },
      putTranslation(surface, id, text, translated) {
        interfaceTranslationCache.set(interfaceTranslationCacheKey(surface, id, text), translated);
      },
      putFailure(surface, id, text, message) {
        interfaceTranslationFailures.set(interfaceTranslationCacheKey(surface, id, text), message);
      },
      renderLocalizedContent,
      translateInterfaceSegments,
    };
  `;
  vm.runInNewContext(`${read("sidepanel.js")}\n${instrumentation}`, sandbox);

  return {
    helpers: sandbox.__YTD_TRANSCRIPT_TESTING__,
    state: sandbox.__YTD_STATE_TESTING__,
    storage: localStorage,
    setActiveTab(tabName) { activeTab = tabName; },
  };
}

test("Transcript, Overview, and Notes expose structurally identical controls", () => {
  const html = read("sidepanel.html");
  const controls = {};
  for (const [surface, label] of [
    ["transcript", "Transcript"],
    ["overview", "Overview"],
    ["notes", "Notes"],
  ]) {
    controls[surface] = html.match(
      new RegExp(`id="${surface}ModeControl"[\\s\\S]*?<\\/div>`),
    )?.[0];
    assert.ok(controls[surface]);
    assert.match(controls[surface], new RegExp(`data-language-surface="${surface}"`));
    assert.match(controls[surface], new RegExp(`aria-label="${label} 显示语言"`));
    assert.match(controls[surface], /role="group"/);
    assert.deepEqual(
      [...controls[surface].matchAll(/data-transcript-mode="([^"]+)"/g)].map((match) => match[1]),
      ["original", "zh", "bilingual"],
    );
    assert.equal((controls[surface].match(/aria-pressed="true"/g) || []).length, 1);
    assert.match(controls[surface], new RegExp(`id="${surface}LangSpinner"`));
  }
});

test("modes persist independently by video and legacy shared choices migrate", async () => {
  const key = "ytd_display_language_modes_by_video";
  const { helpers, storage } = loadHarness({
    storageSeed: {
      [key]: { legacy: { mode: "bilingual", updatedAt: 1 } },
    },
  });

  assert.deepEqual(plain(await helpers.loadAllDisplayLanguageModes("legacy")), {
    transcript: "bilingual",
    overview: "bilingual",
    notes: "bilingual",
  });

  await helpers.saveDisplayLanguageMode("legacy", "zh", "overview");
  await helpers.saveDisplayLanguageMode("legacy", "original", "notes");
  await helpers.saveDisplayLanguageMode("another-video", "bilingual", "transcript");

  assert.deepEqual(plain(storage[key].legacy), {
    transcript: "bilingual",
    overview: "zh",
    notes: "original",
    updatedAt: storage[key].legacy.updatedAt,
  });
  assert.equal(storage[key]["another-video"].transcript, "bilingual");
  assert.deepEqual(plain(await helpers.loadAllDisplayLanguageModes("unseen")), {
    transcript: "original",
    overview: "original",
    notes: "original",
  });
});

test("concurrent mode writes serialize without losing another surface", async () => {
  const key = "ytd_display_language_modes_by_video";
  const { helpers, storage } = loadHarness();

  await Promise.all([
    helpers.saveDisplayLanguageMode("video-a", "bilingual", "transcript"),
    helpers.saveDisplayLanguageMode("video-a", "zh", "overview"),
    helpers.saveDisplayLanguageMode("video-a", "bilingual", "notes"),
  ]);

  assert.deepEqual(plain(storage[key]["video-a"]), {
    transcript: "bilingual",
    overview: "zh",
    notes: "bilingual",
    updatedAt: storage[key]["video-a"].updatedAt,
  });
});

test("only the active surface dispatches translation work", async () => {
  const { helpers, state, setActiveTab } = loadHarness();
  const calls = [];
  state.setWorkers({
    translateTranscript: async () => calls.push("transcript"),
    translateOverviewContent: async () => calls.push("overview"),
    translateNotesContent: async () => calls.push("notes"),
    triggerAnalysis: async () => calls.push("analysis"),
  });
  state.setState({
    currentVideoId: "video-a",
    currentAnalysis: { chapters: [], keyQuotes: [] },
    currentNotes: [{ id: "note-1", text: "Note" }],
    currentNotesOwnerVideoId: "video-a",
    currentNotesAreLoaded: true,
    modes: { transcript: "zh", overview: "bilingual", notes: "zh" },
  });

  for (const surface of ["transcript", "overview", "notes"]) {
    calls.length = 0;
    setActiveTab(surface);
    await helpers.dispatchActiveTabWork();
    assert.deepEqual(calls, [surface]);
  }

  calls.length = 0;
  state.setState({ modes: { transcript: "original", overview: "original", notes: "original" } });
  for (const surface of ["transcript", "overview", "notes"]) {
    setActiveTab(surface);
    await helpers.dispatchActiveTabWork();
  }
  assert.deepEqual(calls, []);

  setActiveTab("overview");
  state.setState({ currentAnalysis: null, isAnalysisLoading: false, modes: { overview: "zh" } });
  await helpers.dispatchActiveTabWork();
  assert.deepEqual(calls, ["analysis"]);
});

test("mode generations invalidate stale interface work and clear in-flight bookkeeping", async () => {
  const response = deferred();
  const { helpers, state, setActiveTab } = loadHarness({
    sendMessage: () => response.promise,
  });
  setActiveTab("overview");
  state.setState({
    currentVideoId: "video-a",
    modes: { overview: "zh" },
    interfaceTranslationGenerations: { overview: 7 },
  });

  const oldRequest = state.translateInterfaceSegments(
    "overview",
    [{ id: "chapter-0-title", text: "Old title" }],
    () => {},
  );
  await nextTurn();
  assert.equal(plain(state.snapshot()).inFlight.length, 1);

  await helpers.handleDisplayLanguageModeChange("overview", "original");
  response.resolve({
    success: true,
    translatedContent: { segments: [{ id: "chapter-0-title", text: "旧标题" }] },
  });
  await oldRequest;

  const snapshot = plain(state.snapshot());
  assert.equal(snapshot.modes.overview, "original");
  assert.equal(snapshot.interfaceTranslationGenerations.overview, 8);
  assert.deepEqual(snapshot.cache, []);
  assert.deepEqual(snapshot.failures, []);
  assert.deepEqual(snapshot.inFlight, []);
  assert.equal(snapshot.translationWorkCounts.overview, 0);
});

test("all surfaces render Original, Chinese, and bilingual content", () => {
  const { helpers, state } = loadHarness();
  state.setState({ currentVideoId: "video-a" });

  for (const surface of ["overview", "notes"]) {
    const id = `${surface}-item`;
    const source = `${surface} source`;
    const translated = `${surface} 译文`;

    state.setState({ modes: { [surface]: "original" } });
    assert.equal(state.renderLocalizedContent(source, surface, id), source);

    state.putTranslation(surface, id, source, translated);
    state.setState({ modes: { [surface]: "zh" } });
    const chinese = state.renderLocalizedContent(source, surface, id);
    assert.doesNotMatch(chinese, new RegExp(`${surface} source`));
    assert.match(chinese, /译文/);

    state.setState({ modes: { [surface]: "bilingual" } });
    const bilingual = state.renderLocalizedContent(source, surface, id);
    assert.match(bilingual, new RegExp(`${surface} source`));
    assert.match(bilingual, /译文/);
    assert.ok(bilingual.indexOf(source) < bilingual.indexOf(translated));
  }

  const segment = { id: "segment-0-0", text: "Transcript source" };
  assert.equal(helpers.renderSubtitleInlineMarkup(segment.text), "Transcript source");
  const chinese = helpers.renderTranscriptSegmentContent(segment, "zh", "Transcript 译文", "");
  assert.doesNotMatch(chinese, /Transcript source/);
  assert.match(chinese, /Transcript 译文/);
  const bilingual = helpers.renderTranscriptSegmentContent(segment, "bilingual", "Transcript 译文", "");
  assert.match(bilingual, /Transcript source/);
  assert.match(bilingual, /Transcript 译文/);
});

test("translation failures keep original text and retry one local segment in Chinese", async () => {
  const requests = [];
  const { helpers, state, setActiveTab } = loadHarness({
    sendMessage: async (message) => {
      requests.push(message);
      return {
        success: true,
        translatedContent: {
          segments: message.content.segments.map((segment) => ({
            id: segment.id,
            text: "重试成功",
          })),
        },
      };
    },
  });
  state.setWorkers({ renderAnalysisResults: () => {}, saveToCache: async () => {} });
  state.setState({
    currentVideoId: "video-a",
    currentAnalysis: {
      chapters: [{ title: "Failed title", summary: "" }],
      keyQuotes: [],
      keyMoments: [],
    },
    modes: { overview: "zh" },
  });
  setActiveTab("overview");
  state.putFailure("overview", "chapter-0-title", "Failed title", "翻译失败，请稍后重试。");

  const failedOverview = state.renderLocalizedContent(
    "Failed title",
    "overview",
    "chapter-0-title",
  );
  assert.match(failedOverview, /Failed title/);
  assert.match(failedOverview, /翻译失败，点击重试/);
  assert.match(failedOverview, /type="button"/);

  const failedTranscript = helpers.renderTranscriptSegmentContent(
    { id: "segment-0-0", text: "Failed transcript" },
    "zh",
    "",
    "翻译请求失败，请稍后重试。",
  );
  assert.match(failedTranscript, /Failed transcript/);
  assert.match(failedTranscript, /翻译失败，点击重试/);

  await helpers.retryInterfaceTranslationSegment("overview", "chapter-0-title");
  assert.equal(requests.length, 1);
  assert.deepEqual(plain(requests[0].content.segments), [
    { id: "chapter-0-title", text: "Failed title" },
  ]);
  const snapshot = plain(state.snapshot());
  assert.equal(snapshot.failures.length, 0);
  assert.equal(snapshot.cache.length, 1);
  assert.equal(snapshot.cache[0][1], "重试成功");
});

test("a Notes response from another video cannot replace the current notes", async () => {
  const responses = [deferred(), deferred()];
  let requestIndex = 0;
  const { helpers, state } = loadHarness({
    sendMessage: () => responses[requestIndex++].promise,
  });
  state.setWorkers({ renderNotes: () => {} });

  state.setState({ currentVideoId: "video-a" });
  const oldRequest = helpers.loadNotes("video-a");
  state.setState({ currentVideoId: "video-b" });
  const currentRequest = helpers.loadNotes("video-b");

  responses[1].resolve({ success: true, notes: [{ id: "b", text: "Current" }] });
  await currentRequest;
  responses[0].resolve({ success: true, notes: [{ id: "a", text: "Stale" }] });
  await oldRequest;

  const snapshot = plain(state.snapshot());
  assert.equal(snapshot.currentNotesOwnerVideoId, "video-b");
  assert.equal(snapshot.currentNotesFilterVideoId, "video-b");
  assert.deepEqual(snapshot.currentNotes, [{ id: "b", text: "Current" }]);
});

test("a stale Overview analysis cannot overwrite the new video's analysis", async () => {
  const responses = [deferred(), deferred()];
  let requestIndex = 0;
  const { helpers, state } = loadHarness({
    sendMessage: () => responses[requestIndex++].promise,
  });
  state.setWorkers({
    renderAnalysisResults: () => {},
    highlightMomentsOnPage: () => {},
    saveToCache: async () => {},
  });

  state.setState({
    currentVideoId: "video-a",
    currentTranscriptTimestamped: "[00:00] A",
    currentVideoTitle: "A",
    currentAnalysis: null,
    isAnalysisLoading: false,
  });
  const oldRequest = helpers.triggerAnalysis();

  state.setState({
    currentVideoId: "video-b",
    currentTranscriptTimestamped: "[00:00] B",
    currentVideoTitle: "B",
    currentAnalysis: null,
    isAnalysisLoading: false,
  });
  const currentRequest = helpers.triggerAnalysis();

  responses[1].resolve({
    success: true,
    analysis: { marker: "current", chapters: [], keyQuotes: [], keyMoments: [] },
  });
  await currentRequest;
  responses[0].resolve({
    success: true,
    analysis: { marker: "stale", chapters: [], keyQuotes: [], keyMoments: [] },
  });
  await oldRequest;

  assert.equal(plain(state.snapshot()).currentAnalysis.marker, "current");
});
