const storageKey = "momentumSettings";
const assistantStorageKey = "momentumAssistant";

const quotes = [
  "The secret of getting ahead is getting started.",
  "Small steps every day add up to big results.",
  "Focus on being productive instead of busy.",
  "What you do today can improve all your tomorrows.",
  "Great things are done by a series of small things brought together.",
];

const defaults = {
  name: "",
  focus: "",
  use24Hour: false,
  tasks: [],
  aiProvider: "chatgpt",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  deepseekApiKey: "",
  deepseekModel: "deepseek-chat",
  geminiApiKey: "",
  geminiModel: "gemini-flash-latest",
  musicVolume: 35,
  musicTrack: "rain",
  focusHistory: [],
  links: [],
  blockNotifications: true,
  customFocusMinutes: 30,
};

let settings = { ...defaults };
let assistantMessages = [];

function readStoredValue(key, callback) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(key, callback);
    return;
  }

  try {
    const value = window.localStorage.getItem(key);
    callback({ [key]: value ? JSON.parse(value) : undefined });
  } catch {
    callback({});
  }
}

function writeStoredValue(key, value) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ [key]: value });
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The dashboard still works for the current page when storage is unavailable.
  }
}

function setNotificationsBlocked(blocked) {
  if (!settings.blockNotifications) return;
  if (typeof chrome === "undefined" || !chrome.contentSettings?.notifications) return;

  // Silences other sites' notification pop-ups while a focus session is running
  // (blocked), and restores the default behavior once it ends (cleared).
  if (blocked) {
    chrome.contentSettings.notifications.set({
      primaryPattern: "<all_urls>",
      setting: "block",
    });
  } else {
    chrome.contentSettings.notifications.clear({});
  }
}

const elements = {
  clock: document.querySelector("#clock"),
  date: document.querySelector("#date"),
  focus: document.querySelector("#focus"),
  greeting: document.querySelector("#greeting"),
  list: document.querySelector("#todo-list"),
  count: document.querySelector("#task-count"),
  name: document.querySelector("#name"),
  twentyFourHour: document.querySelector("#twenty-four-hour"),
  panel: document.querySelector("#settings-panel"),
  backdrop: document.querySelector("#settings-backdrop"),
  assistantButton: document.querySelector("#assistant-button"),
  assistantPanel: document.querySelector("#assistant-panel"),
  assistantMessages: document.querySelector("#assistant-messages"),
  assistantInput: document.querySelector("#assistant-input"),
  assistantModeLabel: document.querySelector("#assistant-mode-label"),
  aiProvider: document.querySelector("#ai-provider"),
  chatgptSettings: document.querySelector("#chatgpt-settings"),
  deepseekSettings: document.querySelector("#deepseek-settings"),
  geminiSettings: document.querySelector("#gemini-settings"),
  openaiKey: document.querySelector("#openai-key"),
  openaiModel: document.querySelector("#openai-model"),
  deepseekKey: document.querySelector("#deepseek-key"),
  deepseekModel: document.querySelector("#deepseek-model"),
  geminiKey: document.querySelector("#gemini-key"),
  geminiModel: document.querySelector("#gemini-model"),
  musicButton: document.querySelector("#music-button"),
  musicVolume: document.querySelector("#music-volume"),
  musicTrack: document.querySelector("#music-track"),
  focusStartRow: document.querySelector("#focus-start-row"),
  focusDuration: document.querySelector("#focus-duration"),
  focusCustomDuration: document.querySelector("#focus-custom-duration"),
  focusStart: document.querySelector("#focus-start"),
  focusCountdown: document.querySelector("#focus-countdown"),
  focusCountdownTime: document.querySelector("#focus-countdown-time"),
  focusCountdownTask: document.querySelector("#focus-countdown-task"),
  focusPause: document.querySelector("#focus-pause"),
  focusStop: document.querySelector("#focus-stop"),
  focusHistoryList: document.querySelector("#focus-history-list"),
  focusDndIndicator: document.querySelector("#focus-dnd-indicator"),
  blockNotifications: document.querySelector("#block-notifications"),
  linksButton: document.querySelector("#links-button"),
  linksDropdown: document.querySelector("#links-dropdown"),
};

let audioContext = null;
let activeSources = [];
let noiseGain = null;
let streamAudio = null;
let musicPlaying = false;

function createNoiseBuffer(context, smoothing) {
  const bufferSize = context.sampleRate * 4;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  let lastSample = 0;
  for (let i = 0; i < bufferSize; i += 1) {
    const white = Math.random() * 2 - 1;
    if (smoothing === null) {
      data[i] = white;
      continue;
    }
    // Low-pass smoothing turns sharp white noise into a softer, rounder tone.
    lastSample = (lastSample + smoothing * white) / (1 + smoothing);
    data[i] = lastSample;
  }
  return buffer;
}

const tracks = {
  // Brown-noise style low-pass smoothing gives a soft, rain-like focus tone.
  rain: { type: "noise", smoothing: 0.02, gain: 3.5 },
  // Raw white noise (no smoothing) sounds like static/hiss.
  white: { type: "noise", smoothing: null, gain: 0.25 },
  // Lighter smoothing than rain gives a breezier, airier wind tone.
  wind: { type: "noise", smoothing: 0.08, gain: 1.6 },
  // A calm low tone with slow vibrato, built from oscillators instead of noise.
  tone: { type: "tone" },
  // Free, publicly streamed lofi/chillout internet radio (requires a connection).
  chill: { type: "stream", url: "https://ice1.somafm.com/groovesalad-128-mp3", label: "SomaFM Groove Salad" },
};

function buildNoiseNode(context, config) {
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, config.smoothing);
  source.loop = true;
  const shaper = context.createGain();
  shaper.gain.value = config.gain;
  source.connect(shaper);
  return { source, output: shaper, nodes: [source] };
}

function buildToneNode(context) {
  const carrier = context.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = 110;

  const lfo = context.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.15;
  const lfoGain = context.createGain();
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain).connect(carrier.frequency);

  const shaper = context.createGain();
  shaper.gain.value = 0.5;
  carrier.connect(shaper);

  return { source: carrier, output: shaper, nodes: [carrier, lfo] };
}

function setMusicVolume(percent) {
  const volume = Math.max(0, Math.min(100, percent)) / 100;
  if (noiseGain) noiseGain.gain.value = volume;
  if (streamAudio) streamAudio.volume = volume;
}

function startStream(config) {
  streamAudio = new Audio(config.url);
  streamAudio.crossOrigin = "anonymous";
  streamAudio.volume = Number(elements.musicVolume.value) / 100;
  streamAudio.play().catch(() => {
    addAssistantMessage("error", "Couldn't reach the online chill radio stream. Check your internet connection and try again.");
    stopMusic();
    updateMusicButtonUi();
  });
  musicPlaying = true;
}

function startMusic() {
  const config = tracks[settings.musicTrack] || tracks.rain;

  if (config.type === "stream") {
    startStream(config);
    return;
  }

  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();

  const built = config.type === "tone" ? buildToneNode(audioContext) : buildNoiseNode(audioContext, config);

  noiseGain = audioContext.createGain();
  setMusicVolume(Number(elements.musicVolume.value));

  built.output.connect(noiseGain).connect(audioContext.destination);
  built.nodes.forEach((node) => node.start());
  activeSources = built.nodes;
  musicPlaying = true;
}

function stopMusic() {
  activeSources.forEach((node) => {
    node.stop();
    node.disconnect();
  });
  activeSources = [];
  if (streamAudio) {
    streamAudio.pause();
    streamAudio.src = "";
    streamAudio = null;
  }
  musicPlaying = false;
}

function restartMusicIfPlaying() {
  if (musicPlaying) {
    stopMusic();
    startMusic();
  }
}

function updateMusicButtonUi() {
  elements.musicButton.setAttribute("aria-pressed", String(musicPlaying));
  elements.musicButton.setAttribute("aria-label", musicPlaying ? "Pause focus music" : "Play focus music");
  elements.musicButton.querySelector("span").textContent = musicPlaying ? "⏸" : "▶";
  elements.musicVolume.hidden = !musicPlaying;
  elements.musicTrack.hidden = !musicPlaying;
}

function toggleMusic() {
  if (musicPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
  updateMusicButtonUi();
}

function getGreeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function renderClock() {
  const now = new Date();
  const timeOptions = { hour: "numeric", minute: "2-digit", hour12: !settings.use24Hour };
  elements.clock.textContent = now.toLocaleTimeString([], timeOptions);
  elements.date.textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  elements.greeting.textContent = `${getGreeting(now.getHours())}${settings.name ? `, ${settings.name}` : ""}.`;
}

let focusTimer = {
  intervalId: null,
  endTime: 0,
  totalSeconds: 0,
  remainingSeconds: 0,
  task: "",
  isPaused: false,
};

function formatCountdown(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatHistoryTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderFocusHistory() {
  elements.focusHistoryList.replaceChildren();

  if (!settings.focusHistory.length) {
    const empty = document.createElement("li");
    empty.className = "focus-history-empty";
    empty.textContent = "No focus sessions yet. Start one above to build your history.";
    elements.focusHistoryList.append(empty);
    return;
  }

  settings.focusHistory
    .slice()
    .reverse()
    .forEach((entry) => {
      const item = document.createElement("li");
      item.className = `focus-history-item ${entry.completed ? "completed" : "stopped"}`;

      const task = document.createElement("span");
      task.className = "focus-history-task";
      task.textContent = entry.task || "Untitled focus";

      const meta = document.createElement("span");
      meta.className = "focus-history-meta";
      const statusText = entry.completed
        ? `${entry.plannedMinutes} min ✓`
        : `stopped at ${formatCountdown(entry.actualSeconds)}`;
      meta.textContent = `${statusText} · ${formatHistoryTimestamp(entry.timestamp)}`;

      item.append(task, meta);
      elements.focusHistoryList.append(item);
    });
}

function stopFocusTimerInterval() {
  if (focusTimer.intervalId) {
    clearInterval(focusTimer.intervalId);
    focusTimer.intervalId = null;
  }
}

function resetFocusUi() {
  elements.focusStartRow.hidden = false;
  elements.focusCountdown.hidden = true;
  elements.focus.disabled = false;
  elements.focusDuration.disabled = false;
  elements.focusCustomDuration.disabled = false;
  elements.focusPause.textContent = "Pause";
  setNotificationsBlocked(false);
  elements.focusDndIndicator.hidden = true;
}

function finishFocusSession(completed) {
  const remainingSeconds = focusTimer.isPaused
    ? focusTimer.remainingSeconds
    : Math.max(0, Math.round((focusTimer.endTime - Date.now()) / 1000));
  const actualSeconds = completed ? focusTimer.totalSeconds : focusTimer.totalSeconds - remainingSeconds;

  stopFocusTimerInterval();
  focusTimer.isPaused = false;
  settings.focusHistory.push({
    task: focusTimer.task,
    plannedMinutes: Math.round(focusTimer.totalSeconds / 60),
    actualSeconds: Math.max(0, actualSeconds),
    completed,
    timestamp: new Date().toISOString(),
  });
  save();
  renderFocusHistory();
  resetFocusUi();

  if (completed) {
    addAssistantMessage(
      "assistant",
      `Nice work! You finished a ${Math.round(focusTimer.totalSeconds / 60)}-minute focus session on "${focusTimer.task}".`,
    );
  }
}

function tickFocusCountdown() {
  const remainingMs = focusTimer.endTime - Date.now();
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  focusTimer.remainingSeconds = Math.max(0, remainingSeconds);

  if (remainingSeconds <= 0) {
    elements.focusCountdownTime.textContent = "0:00";
    finishFocusSession(true);
    return;
  }

  elements.focusCountdownTime.textContent = formatCountdown(remainingSeconds);
}

function pauseFocusSession() {
  if (focusTimer.isPaused) return;
  focusTimer.remainingSeconds = Math.max(0, Math.ceil((focusTimer.endTime - Date.now()) / 1000));
  stopFocusTimerInterval();
  focusTimer.isPaused = true;
  elements.focusPause.textContent = "Resume";
}

function resumeFocusSession() {
  if (!focusTimer.isPaused) return;
  focusTimer.endTime = Date.now() + focusTimer.remainingSeconds * 1000;
  focusTimer.isPaused = false;
  elements.focusPause.textContent = "Pause";
  stopFocusTimerInterval();
  focusTimer.intervalId = setInterval(tickFocusCountdown, 1000);
}

function togglePauseFocusSession() {
  if (focusTimer.isPaused) {
    resumeFocusSession();
  } else {
    pauseFocusSession();
  }
}

function startFocusSession() {
  const task = elements.focus.value.trim() || "Untitled focus";
  let minutes = 25;
  if (elements.focusDuration.value === "custom") {
    const rawVal = elements.focusCustomDuration.value.trim();
    const customVal = Number(rawVal);
    if (!rawVal || isNaN(customVal) || customVal <= 0) {
      elements.focusCustomDuration.focus();
      return;
    }
    minutes = Math.min(Math.max(Math.round(customVal), 1), 720);
    settings.customFocusMinutes = minutes;
  } else {
    minutes = Number(elements.focusDuration.value) || 25;
  }

  settings.focus = task;
  save();

  focusTimer.totalSeconds = minutes * 60;
  focusTimer.endTime = Date.now() + focusTimer.totalSeconds * 1000;
  focusTimer.remainingSeconds = focusTimer.totalSeconds;
  focusTimer.task = task;
  focusTimer.isPaused = false;

  elements.focusStartRow.hidden = true;
  elements.focusCountdown.hidden = false;
  elements.focus.disabled = true;
  elements.focusDuration.disabled = true;
  elements.focusCustomDuration.disabled = true;
  elements.focusPause.textContent = "Pause";
  elements.focusCountdownTask.textContent = `Focusing on "${task}"`;
  elements.focusCountdownTime.textContent = formatCountdown(focusTimer.totalSeconds);
  setNotificationsBlocked(true);
  elements.focusDndIndicator.hidden = !settings.blockNotifications;

  stopFocusTimerInterval();
  focusTimer.intervalId = setInterval(tickFocusCountdown, 1000);
}

const syncStorageKey = "momentumSyncedSettings";
const localOnlySettingKeys = ["openaiApiKey", "deepseekApiKey", "geminiApiKey", "focusHistory"];

function syncedSettingsSubset() {
  const subset = { ...settings };
  localOnlySettingKeys.forEach((key) => delete subset[key]);
  return subset;
}

function save() {
  writeStoredValue(storageKey, settings);

  // API keys and history stay on this device; everything else follows the Google account.
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.set({ [syncStorageKey]: syncedSettingsSubset() }, () => {
      void chrome.runtime.lastError;
    });
  }
}

function readSyncedSettings(callback) {
  if (typeof chrome === "undefined" || !chrome.storage?.sync) {
    callback({});
    return;
  }
  chrome.storage.sync.get(syncStorageKey, (result) => {
    callback(chrome.runtime.lastError ? {} : result[syncStorageKey] || {});
  });
}

function saveAssistant() {
  writeStoredValue(assistantStorageKey, assistantMessages.slice(-40));
}

function renderAssistant() {
  elements.assistantMessages.replaceChildren();
  assistantMessages.forEach((message) => {
    const paragraph = document.createElement("p");
    paragraph.className = `assistant-message ${message.role}`;
    paragraph.textContent = message.text;
    elements.assistantMessages.append(paragraph);
  });
  elements.assistantMessages.scrollTop = elements.assistantMessages.scrollHeight;
}

const aiProviderLabels = {
  chatgpt: "ChatGPT",
  deepseek: "DeepSeek",
  gemini: "Gemini",
  offline: "Offline coach",
};

function currentAiApiKey() {
  if (settings.aiProvider === "chatgpt") return settings.openaiApiKey;
  if (settings.aiProvider === "deepseek") return settings.deepseekApiKey;
  if (settings.aiProvider === "gemini") return settings.geminiApiKey;
  return "";
}

function updateAssistantModeLabel() {
  elements.assistantModeLabel.textContent = aiProviderLabels[settings.aiProvider] || "Offline coach";
}

function updateAiProviderVisibility() {
  elements.chatgptSettings.hidden = settings.aiProvider !== "chatgpt";
  elements.deepseekSettings.hidden = settings.aiProvider !== "deepseek";
  elements.geminiSettings.hidden = settings.aiProvider !== "gemini";
}

function welcomeMessage() {
  if (settings.aiProvider === "offline") {
    return "I’m your private, offline focus coach. Ask me for a plan, a task suggestion, or a little momentum.";
  }
  const providerName = aiProviderLabels[settings.aiProvider];
  return currentAiApiKey()
    ? `I’m connected to ${providerName}. Ask me for a plan, a task suggestion, or a little momentum.`
    : `I’m your online assistant, powered by ${providerName}. Add your ${providerName} API key in Settings to start chatting, or switch to the offline coach.`;
}

function createAssistantReply(message) {
  const lowerMessage = message.toLowerCase();
  const openTasks = settings.tasks.filter((task) => !task.completed);
  const focus = settings.focus || "your most important task";

  if (lowerMessage.includes("plan") || lowerMessage.includes("start")) {
    const firstTask = openTasks[0]?.text || focus;
    return `Try this 25-minute sprint:\n1. Start with "${firstTask}".\n2. Remove one distraction.\n3. Work until the timer ends, then take a five-minute break.`;
  }
  if (lowerMessage.includes("task") || lowerMessage.includes("todo")) {
    return openTasks.length
      ? `You have ${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}. The best next step is "${openTasks[0].text}".`
      : "Your task list is clear. Capture one small next step for today's focus.";
  }
  if (lowerMessage.includes("motivat") || lowerMessage.includes("stuck") || lowerMessage.includes("focus")) {
    return `Keep it small: spend five minutes on "${focus}", then decide whether to continue. Starting is the hard part.`;
  }
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return `Hi${settings.name ? ` ${settings.name}` : ""}! Your focus today is "${focus}". How can I help you move it forward?`;
  }
  return `I’m an offline focus coach, so I can help with plans, tasks, and momentum. Try asking “How should I start?”`;
}

function addAssistantMessage(role, text) {
  assistantMessages.push({ role, text });
  saveAssistant();
  renderAssistant();
}

function buildCoachSystemPrompt() {
  const openTasks = settings.tasks.filter((task) => !task.completed).map((task) => task.text);
  return `You are a warm, concise productivity coach embedded in a browser new-tab dashboard. The user's name is "${settings.name || "unknown"}", their focus for today is "${settings.focus || "not set"}", and their open tasks are: ${openTasks.length ? openTasks.join(", ") : "none"}. Keep replies under 100 words.`;
}

async function fetchOpenAiCompatibleReply({ endpoint, apiKey, model, message }) {
  const systemPrompt = buildCoachSystemPrompt();

  const history = assistantMessages.slice(-8).map((entry) => ({
    role: entry.role === "user" ? "user" : "assistant",
    content: entry.text,
  }));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("The assistant returned an empty response.");
  return reply;
}

async function fetchGeminiReply({ apiKey, model, message }) {
  const systemPrompt = buildCoachSystemPrompt();

  const history = assistantMessages.slice(-8).map((entry) => ({
    role: entry.role === "user" ? "user" : "model",
    parts: [{ text: entry.text }],
  }));

  const primaryModel = model || "gemini-flash-latest";
  const fallbackModel = "gemini-flash-lite-latest";

  async function sendRequest(targetModel) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents: [...history, { role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 600 },
      }),
    });
  }

  let response = await sendRequest(primaryModel);

  // If primary model is unavailable or overloaded (e.g. 503, 429, or high demand), attempt automatic fallback
  if (!response.ok && primaryModel !== fallbackModel) {
    const errData = await response.clone().json().catch(() => ({}));
    const errMsg = (errData?.error?.message || "").toLowerCase();
    if (response.status === 503 || response.status === 429 || errMsg.includes("demand") || errMsg.includes("overloaded") || errMsg.includes("resource") || errMsg.includes("not found")) {
      const fallbackResponse = await sendRequest(fallbackModel);
      if (fallbackResponse.ok) {
        response = fallbackResponse;
      }
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("").trim();
  if (!reply) throw new Error("The assistant returned an empty response.");
  return reply;
}

function fetchAiReply(message) {
  if (settings.aiProvider === "chatgpt") {
    return fetchOpenAiCompatibleReply({
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: settings.openaiApiKey,
      model: settings.openaiModel || "gpt-4o-mini",
      message,
    });
  }
  if (settings.aiProvider === "deepseek") {
    return fetchOpenAiCompatibleReply({
      endpoint: "https://api.deepseek.com/chat/completions",
      apiKey: settings.deepseekApiKey,
      model: settings.deepseekModel || "deepseek-chat",
      message,
    });
  }
  if (settings.aiProvider === "gemini") {
    return fetchGeminiReply({
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel || "gemini-flash-latest",
      message,
    });
  }
  return Promise.reject(new Error("No online assistant selected."));
}

async function handleAssistantMessage(message) {
  addAssistantMessage("user", message);

  if (settings.aiProvider === "offline") {
    addAssistantMessage("assistant", createAssistantReply(message));
    return;
  }

  const providerName = aiProviderLabels[settings.aiProvider];
  if (!currentAiApiKey()) {
    addAssistantMessage(
      "error",
      `Add your ${providerName} API key in Settings to chat online, or switch to the offline coach.`,
    );
    return;
  }

  assistantMessages.push({ role: "pending", text: "Thinking…" });
  renderAssistant();

  try {
    const reply = await fetchAiReply(message);
    assistantMessages.pop();
    addAssistantMessage("assistant", reply);
  } catch (error) {
    assistantMessages.pop();
    addAssistantMessage("error", `${providerName} request failed: ${error.message}`);
  }
}

function renderTasks() {
  elements.list.replaceChildren();
  const remaining = settings.tasks.filter((task) => !task.completed).length;
  elements.count.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;

  settings.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `todo-item${task.completed ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Complete ${task.text}`);
    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      save();
      renderTasks();
    });

    const label = document.createElement("label");
    label.textContent = task.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-task";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${task.text}`);
    deleteButton.addEventListener("click", () => {
      settings.tasks = settings.tasks.filter((candidate) => candidate.id !== task.id);
      save();
      renderTasks();
    });

    item.append(checkbox, label, deleteButton);
    elements.list.append(item);
  });
}

function toggleSettings(open) {
  elements.panel.hidden = !open;
  elements.backdrop.hidden = !open;
  if (open) elements.name.focus();
}

function faviconLetter(label, url) {
  const source = label.trim() || url.replace(/^https?:\/\/(www\.)?/i, "");
  return source.charAt(0).toUpperCase() || "?";
}

function renderLinks() {
  document.querySelectorAll(".links-list").forEach((list) => {
    list.replaceChildren();

    if (!settings.links.length) {
      const empty = document.createElement("li");
      empty.className = "links-empty";
      empty.textContent = "No links yet — add one below.";
      list.append(empty);
      return;
    }

    settings.links.forEach((link) => {
      const item = document.createElement("li");
      item.className = "links-item";

      const favicon = document.createElement("span");
      favicon.className = "link-favicon";
      favicon.setAttribute("aria-hidden", "true");
      favicon.textContent = faviconLetter(link.label, link.url);

      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = link.label || link.url;
      anchor.addEventListener("click", (event) => {
        // The Chrome new-tab override page can swallow a plain target="_blank"
        // navigation, so open the tab explicitly through the extension API
        // (falling back to window.open on a normal web page).
        event.preventDefault();
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
          chrome.tabs.create({ url: link.url });
        } else {
          window.open(link.url, "_blank", "noopener,noreferrer");
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-link";
      deleteButton.textContent = "×";
      deleteButton.setAttribute("aria-label", `Remove ${link.label || link.url}`);
      deleteButton.addEventListener("click", () => {
        settings.links = settings.links.filter((candidate) => candidate.id !== link.id);
        save();
        renderLinks();
      });

      item.append(favicon, anchor, deleteButton);
      list.append(item);
    });
  });
}

function addLink(rawLabel, rawUrl) {
  const label = rawLabel.trim();
  let url = rawUrl.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  settings.links.push({ id: crypto.randomUUID(), label, url });
  save();
  renderLinks();
}

document.querySelector("#todo-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#todo-input");
  const text = input.value.trim();
  if (!text) return;
  settings.tasks.push({ id: crypto.randomUUID(), text, completed: false });
  input.value = "";
  save();
  renderTasks();
});

elements.focus.addEventListener("change", () => {
  settings.focus = elements.focus.value.trim();
  save();
});

elements.focusDuration.addEventListener("change", () => {
  const isCustom = elements.focusDuration.value === "custom";
  elements.focusCustomDuration.hidden = !isCustom;
  if (isCustom) {
    elements.focusCustomDuration.focus();
  }
});

elements.focusCustomDuration.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    startFocusSession();
  }
});

elements.focusStart.addEventListener("click", () => startFocusSession());
elements.focusPause.addEventListener("click", () => togglePauseFocusSession());
elements.focusStop.addEventListener("click", () => finishFocusSession(false));

document.querySelector("#clear-focus-history").addEventListener("click", () => {
  settings.focusHistory = [];
  save();
  renderFocusHistory();
});

elements.name.addEventListener("input", () => {
  settings.name = elements.name.value.trim();
  save();
  renderClock();
});

elements.twentyFourHour.addEventListener("change", () => {
  settings.use24Hour = elements.twentyFourHour.checked;
  save();
  renderClock();
});

elements.blockNotifications.addEventListener("change", () => {
  settings.blockNotifications = elements.blockNotifications.checked;
  save();
  if (!settings.blockNotifications) {
    setNotificationsBlocked(false);
    elements.focusDndIndicator.hidden = true;
  } else if (!elements.focusCountdown.hidden) {
    setNotificationsBlocked(true);
    elements.focusDndIndicator.hidden = false;
  }
});

document.querySelector("#clear-tasks").addEventListener("click", () => {
  settings.tasks = settings.tasks.filter((task) => !task.completed);
  save();
  renderTasks();
});

document.querySelectorAll(".links-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const label = form.querySelector(".link-label");
    const url = form.querySelector(".link-url");
    addLink(label.value, url.value);
    label.value = "";
    url.value = "";
  });
});

elements.linksButton.addEventListener("click", () => {
  const isOpen = !elements.linksDropdown.hidden;
  elements.linksDropdown.hidden = isOpen;
  elements.linksButton.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (elements.linksDropdown.hidden) return;
  if (event.target.closest(".links-widget")) return;
  elements.linksDropdown.hidden = true;
  elements.linksButton.setAttribute("aria-expanded", "false");
});

document.querySelectorAll(".settings-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".settings-tab").forEach((candidate) => {
      candidate.setAttribute("aria-selected", String(candidate === tab));
    });
    document.querySelectorAll(".settings-tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `settings-tab-${tab.dataset.tab}`;
    });
  });
});

elements.aiProvider.addEventListener("change", () => {
  settings.aiProvider = elements.aiProvider.value;
  save();
  updateAssistantModeLabel();
  updateAiProviderVisibility();
});

elements.openaiKey.addEventListener("input", () => {
  settings.openaiApiKey = elements.openaiKey.value.trim();
  save();
});

elements.openaiModel.addEventListener("change", () => {
  settings.openaiModel = elements.openaiModel.value;
  save();
});

elements.deepseekKey.addEventListener("input", () => {
  settings.deepseekApiKey = elements.deepseekKey.value.trim();
  save();
});

elements.deepseekModel.addEventListener("change", () => {
  settings.deepseekModel = elements.deepseekModel.value;
  save();
});

elements.geminiKey.addEventListener("input", () => {
  settings.geminiApiKey = elements.geminiKey.value.trim();
  save();
});

elements.geminiModel.addEventListener("change", () => {
  settings.geminiModel = elements.geminiModel.value;
  save();
});

elements.musicButton.addEventListener("click", () => toggleMusic());

elements.musicVolume.addEventListener("input", () => {
  settings.musicVolume = Number(elements.musicVolume.value);
  setMusicVolume(settings.musicVolume);
  save();
});

elements.musicTrack.addEventListener("change", () => {
  settings.musicTrack = elements.musicTrack.value;
  save();
  restartMusicIfPlaying();
});

document.querySelector("#settings-button").addEventListener("click", () => toggleSettings(true));
document.querySelector("#close-settings").addEventListener("click", () => toggleSettings(false));
elements.backdrop.addEventListener("click", () => toggleSettings(false));

document.querySelector("#assistant-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const message = elements.assistantInput.value.trim();
  if (!message) return;
  elements.assistantInput.value = "";
  handleAssistantMessage(message);
});

document.querySelector("#clear-assistant").addEventListener("click", () => {
  assistantMessages = [];
  saveAssistant();
  renderAssistant();
});

elements.assistantButton.addEventListener("click", () => {
  elements.assistantPanel.hidden = false;
  elements.assistantButton.hidden = true;
  elements.assistantInput.focus();
});

document.querySelector("#close-assistant").addEventListener("click", () => {
  elements.assistantPanel.hidden = true;
  elements.assistantButton.hidden = false;
});

readSyncedSettings((syncedSettings) => {
readStoredValue(storageKey, (settingsResult) => {
  readStoredValue(assistantStorageKey, (assistantResult) => {
    const storedSettings = { ...(settingsResult[storageKey] || {}), ...syncedSettings };
    settings = { ...defaults, ...storedSettings };
    assistantMessages = Array.isArray(assistantResult[assistantStorageKey])
      ? assistantResult[assistantStorageKey]
      : [];
    if (!Array.isArray(settings.focusHistory)) settings.focusHistory = [];
  if (!Array.isArray(settings.links)) settings.links = [];
  if (typeof storedSettings.aiProvider !== "string" && typeof storedSettings.useChatGpt === "boolean") {
    // Migrate the old on/off ChatGPT toggle to the new provider selection.
    settings.aiProvider = storedSettings.useChatGpt === false ? "offline" : "chatgpt";
  }
  if (!settings.geminiModel || settings.geminiModel.startsWith("gemini-1.5") || settings.geminiModel.startsWith("gemini-2.0") || settings.geminiModel === "gemini-3.8-flash") {
    // gemini-flash-latest points to Google's current active stable release and avoids high-demand spikes
    settings.geminiModel = "gemini-flash-latest";
  }
  delete settings.useChatGpt;
  elements.focus.value = settings.focus;
  elements.name.value = settings.name;
  elements.twentyFourHour.checked = settings.use24Hour;
  elements.aiProvider.value = settings.aiProvider;
  elements.openaiKey.value = settings.openaiApiKey;
  elements.openaiModel.value = settings.openaiModel;
  elements.deepseekKey.value = settings.deepseekApiKey;
  elements.deepseekModel.value = settings.deepseekModel;
  elements.geminiKey.value = settings.geminiApiKey;
  elements.geminiModel.value = settings.geminiModel;
  elements.musicVolume.value = settings.musicVolume;
  elements.musicTrack.value = settings.musicTrack;
  elements.blockNotifications.checked = settings.blockNotifications;
  elements.focusCustomDuration.value = settings.customFocusMinutes || 30;
  updateAssistantModeLabel();
  updateAiProviderVisibility();
  document.querySelector("#quote").textContent = quotes[new Date().getDate() % quotes.length];
  renderClock();
  renderTasks();
  renderAssistant();
  renderFocusHistory();
  renderLinks();
  if (!assistantMessages.length) {
    addAssistantMessage("assistant", welcomeMessage());
  }
  setInterval(renderClock, 1000);
  });
});
});

const backgroundPhotoIds = [
  "1506744038136-46273834b3fb",
  "1469474968028-56623f02e42e",
  "1441974231531-c6227db76b6e",
  "1507525428034-b723cf961d3e",
  "1519681393784-d120267933ba",
  "1500530855697-b586d89ba3ee",
  "1470071459604-3b5ec3a7fe05",
  "1501785888041-af3ef285b470",
  "1472214103451-9374bd1c798e",
  "1418065460487-3e41a6c84dc5",
  "1476514525535-07fb3b4ae5f1",
  "1464822759023-fed622ff2c3b",
];

function startBackgroundSlideshow() {
  const layers = [document.querySelector("#bg-a"), document.querySelector("#bg-b")];
  if (!layers[0] || !layers[1]) return;
  const order = [...backgroundPhotoIds].sort(() => Math.random() - 0.5);
  let index = 0;
  let front = 0;

  const showNext = () => {
    const id = order[index % order.length];
    index += 1;
    const url = "https://images.unsplash.com/photo-" + id + "?auto=format&fit=crop&w=1920&q=70";
    const loader = new Image();
    loader.onload = () => {
      const next = layers[1 - front];
      next.style.backgroundImage = "url(\"" + url + "\")";
      next.classList.add("visible");
      layers[front].classList.remove("visible");
      front = 1 - front;
    };
    loader.src = url;
  };

  showNext();
  setInterval(showNext, 60000);
}

startBackgroundSlideshow();