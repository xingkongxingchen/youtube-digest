const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

async function waitFor(predicate, message, turns = 30) {
  for (let turn = 0; turn < turns; turn += 1) {
    if (predicate()) return;
    await nextTurn();
  }
  assert.fail(message);
}

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
  const classes = new Set();
  const children = [];
  const node = {
    dataset: {},
    style: {},
    children,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
      contains(name) { return classes.has(name); },
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
    appendChild(child) { children.push(child); },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  Object.defineProperty(node, "className", {
    get() { return [...classes].join(" "); },
    set(value) {
      classes.clear();
      String(value).split(/\s+/).filter(Boolean).forEach((name) => classes.add(name));
    },
  });
  return node;
}

function loadHarness({
  storageSeed = {},
  sendMessage = () => Promise.resolve({}),
} = {}) {
  const localStorage = { ...storageSeed };
  const sessionStorage = {};
  const elements = new Map();
  const observers = [];
  let activeTab = "transcript";
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const tabs = ["transcript", "overview", "notes"].map((tabName) => ({
    dataset: { tab: tabName },
    classList: {
      toggle(name, enabled) {
        if (name === "active" && enabled) activeTab = tabName;
      },
    },
  }));
  const panels = ["transcript", "overview", "notes"].map((tabName) => ({
    dataset: { panel: tabName },
    classList: { toggle() {} },
  }));
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
      constructor(callback) {
        this.callback = callback;
        this.observed = [];
        this.disconnected = false;
        observers.push(this);
      }
      observe(target) { this.observed.push(target); }
      disconnect() { this.disconnected = true; }
      trigger(indices = this.observed.map((_, index) => index)) {
        this.callback(
          indices.map((index) => ({ target: this.observed[index], isIntersecting: true })),
        );
      }
    },
    CSS: { escape: (value) => value },
    navigator: { clipboard: { writeText: async () => {} } },
    window: { getSelection: () => null, close() {} },
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === ".tab.active") return { dataset: { tab: activeTab } };
        const panel = selector.match(/^\.tab-panel\[data-panel="([^"]+)"\]\.active$/);
        if (panel) return panel[1] === activeTab ? element(`${activeTab}Panel`) : null;
        const segment = selector.match(/^\.transcript-entry\[data-segment-id="([^"]+)"\]$/);
        if (segment) {
          return element("transcriptList").children.find(
            (row) => row.dataset.segmentId === segment[1],
          ) || null;
        }
        const segmentIndex = selector.match(/^\.transcript-entry\[data-segment-index="([^"]+)"\]$/);
        if (segmentIndex) {
          return element("transcriptList").children.find(
            (row) => row.dataset.segmentIndex === segmentIndex[1],
          ) || null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === ".tab") return tabs;
        if (selector === ".tab-panel") return panels;
        return [];
      },
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
          transcriptCache: [...transcriptParagraphCache.entries()],
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
      putTranscriptTranslation(segment, translated) {
        transcriptParagraphCache.set(transcriptTranslationCacheKey(segment), translated);
      },
      renderLocalizedContent,
      translateInterfaceSegments,
      translateTranscript,
      switchTab,
    };
  `;
  vm.runInNewContext(`${read("sidepanel.js")}\n${instrumentation}`, sandbox);

  return {
    helpers: sandbox.__YTD_TRANSCRIPT_TESTING__,
    state: sandbox.__YTD_STATE_TESTING__,
    storage: localStorage,
    observers,
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

for (const surface of ["overview", "notes"]) {
  test(`${surface} stops stale batches when hidden and resumes only missing content`, async () => {
    const staleResponse = deferred();
    const requests = [];
    let firstRequest = true;
    let rerenders = 0;
    let cacheWrites = 0;
    const { helpers, state, setActiveTab } = loadHarness({
      sendMessage(message) {
        requests.push(message);
        if (firstRequest) {
          firstRequest = false;
          return staleResponse.promise;
        }
        return Promise.resolve({
          success: true,
          translatedContent: {
            segments: message.content.segments.map((segment) => ({
              id: segment.id,
              text: `新译文-${segment.id}`,
            })),
          },
        });
      },
    });
    state.setWorkers({
      renderAnalysisResults: () => { rerenders += 1; },
      renderNotes: () => { rerenders += 1; },
      saveToCache: async () => { cacheWrites += 1; },
    });

    const sourceSegments = Array.from({ length: 7 }, (_, index) => ({
      id: surface === "overview" ? `chapter-${index}-title` : `note-note-${index}`,
      text: `${surface} source ${index}`,
    }));
    const stateUpdate = {
      currentVideoId: "video-a",
      modes: { transcript: "original", overview: "original", notes: "original", [surface]: "zh" },
    };
    if (surface === "overview") {
      stateUpdate.currentAnalysis = {
        chapters: sourceSegments.map((segment) => ({ title: segment.text, summary: "" })),
        keyQuotes: [],
        keyMoments: [],
      };
    } else {
      stateUpdate.currentNotes = sourceSegments.map((segment, index) => ({
        id: `note-${index}`,
        text: segment.text,
      }));
      stateUpdate.currentNotesFilterVideoId = "video-a";
      stateUpdate.currentNotesOwnerVideoId = "video-a";
      stateUpdate.currentNotesAreLoaded = true;
    }
    state.setState(stateUpdate);
    state.putTranslation(surface, sourceSegments[0].id, sourceSegments[0].text, "已缓存译文");
    setActiveTab(surface);

    const oldWork = helpers.dispatchActiveTabWork();
    await waitFor(() => requests.length === 1, `${surface} did not start its first batch`);
    assert.deepEqual(
      plain(requests[0].content.segments).map((segment) => segment.id),
      sourceSegments.slice(1, 4).map((segment) => segment.id),
    );

    state.switchTab(surface === "overview" ? "notes" : "transcript");
    staleResponse.resolve({
      success: true,
      translatedContent: {
        segments: requests[0].content.segments.map((segment) => ({
          id: segment.id,
          text: `过期译文-${segment.id}`,
        })),
      },
    });
    await oldWork;
    await nextTurn();

    assert.equal(requests.length, 1, "a hidden stale generation sent a second batch");
    assert.equal(rerenders, 0, "a hidden stale response rerendered its surface");
    assert.equal(cacheWrites, 0, "a hidden stale response persisted cache");
    let snapshot = plain(state.snapshot());
    assert.equal(snapshot.cache.length, 1);
    assert.equal(snapshot.cache[0][1], "已缓存译文");
    assert.deepEqual(snapshot.inFlight, []);

    state.switchTab(surface);
    await waitFor(
      () => requests.length === 3 && plain(state.snapshot()).cache.length === 7,
      `${surface} did not resume all missing batches`,
    );
    snapshot = plain(state.snapshot());
    const resumedIds = requests
      .slice(1)
      .flatMap((request) => plain(request.content.segments).map((segment) => segment.id));
    assert.deepEqual(resumedIds, sourceSegments.slice(1).map((segment) => segment.id));
    assert.ok(snapshot.cache.every(([, value]) => !value.startsWith("过期译文-")));
    assert.equal(cacheWrites, 2);
  });
}

test("Transcript disconnects queued work when hidden and resumes from its cache", async () => {
  const staleResponse = deferred();
  const requests = [];
  let firstRequest = true;
  const { helpers, state, observers, setActiveTab } = loadHarness({
    sendMessage(message) {
      requests.push(message);
      if (firstRequest) {
        firstRequest = false;
        return staleResponse.promise;
      }
      return Promise.resolve({
        success: true,
        translatedContent: {
          segments: message.content.segments.map((segment) => ({
            id: segment.id,
            text: `新译文-${segment.id}`,
          })),
        },
      });
    },
  });
  state.setWorkers({ saveToCache: async () => {} });
  const transcript = Array.from({ length: 7 }, (_, index) => ({
    start: index * 5,
    duration: 4,
    text: `Segment ${index} ${"complete thought ".repeat(6)}.`,
  }));
  state.setState({
    currentVideoId: "video-a",
    currentTranscript: transcript,
    modes: { transcript: "zh", overview: "original", notes: "original" },
  });
  // Use the same grouping helper through the instrumented function so cache
  // keys exactly match the rows produced by translateTranscript.
  const segmentSource = plain(helpers.groupTranscriptEntries(transcript));
  state.putTranscriptTranslation(segmentSource[0], "已缓存字幕");
  setActiveTab("transcript");

  const oldWork = state.translateTranscript();
  await waitFor(() => requests.length === 1, "Transcript did not start its first batch");
  assert.ok(observers.length > 0);
  const oldObserver = observers.at(-1);
  oldObserver.trigger();

  state.switchTab("notes");
  assert.equal(oldObserver.disconnected, true);
  staleResponse.resolve({
    success: true,
    translatedContent: {
      segments: requests[0].content.segments.map((segment) => ({
        id: segment.id,
        text: `过期译文-${segment.id}`,
      })),
    },
  });
  await oldWork;
  await nextTurn();
  assert.equal(requests.length, 1, "the old observer queue sent another batch");
  assert.equal(plain(state.snapshot()).transcriptCache.length, 1);

  state.switchTab("transcript");
  await waitFor(
    () => requests.length >= 2 && plain(state.snapshot()).transcriptCache.length >= 3,
    "Transcript did not resume its first missing batch",
  );
  const resumedObserver = observers.at(-1);
  resumedObserver.trigger();
  await waitFor(
    () => plain(state.snapshot()).transcriptCache.length === segmentSource.length,
    "Transcript did not resume observer batches",
  );

  const resumedIds = requests
    .slice(1)
    .flatMap((request) => plain(request.content.segments).map((segment) => segment.id));
  assert.deepEqual(resumedIds, segmentSource.slice(1).map((segment) => segment.id));
  assert.equal(resumedObserver.disconnected, false);
  assert.ok(
    plain(state.snapshot()).transcriptCache.every(([, value]) => !value.startsWith("过期译文-")),
  );
});

test("partial provider output uses a Chinese local error and keeps retryable original text", async () => {
  const { state, setActiveTab } = loadHarness({
    sendMessage: async () => ({
      success: true,
      translatedContent: {
        segments: [{ id: "chapter-0-title", text: "第一节" }],
      },
    }),
  });
  setActiveTab("overview");
  state.setState({ currentVideoId: "video-a", modes: { overview: "zh" } });
  await state.translateInterfaceSegments(
    "overview",
    [
      { id: "chapter-0-title", text: "First chapter" },
      { id: "chapter-1-title", text: "Missing chapter" },
    ],
    () => {},
  );

  const failed = state.renderLocalizedContent(
    "Missing chapter",
    "overview",
    "chapter-1-title",
  );
  assert.match(failed, /Missing chapter/);
  assert.match(failed, /部分内容未能翻译/);
  assert.match(failed, /翻译失败，点击重试/);
  assert.doesNotMatch(failed, /Translation unavailable/i);
});
