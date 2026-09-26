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
  useChatGpt: true,
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  musicVolume: 35,
  musicTrack: "rain",
  focusHistory: [],
  links: [],
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
  useChatGpt: document.querySelector("#use-chatgpt"),
  openaiKey: document.querySelector("#openai-key"),
  openaiModel: document.querySelector("#openai-model"),
  musicButton: document.querySelector("#music-button"),
  musicVolume: document.querySelector("#music-volume"),
  musicTrack: document.querySelector("#music-track"),
  focusStartRow: document.querySelector("#focus-start-row"),
  focusDuration: document.querySelector("#focus-duration"),
  focusStart: document.querySelector("#focus-start"),
  focusCountdown: document.querySelector("#focus-countdown"),
  focusCountdownTime: document.querySelector("#focus-countdown-time"),
  focusCountdownTask: document.querySelector("#focus-countdown-task"),
  focusPause: document.querySelector("#focus-pause"),
  focusStop: document.querySelector("#focus-stop"),
  focusHistoryList: document.querySelector("#focus-history-list"),
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
  elements.focusPause.textContent = "Pause";
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
  const minutes = Number(elements.focusDuration.value) || 25;

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
  elements.focusPause.textContent = "Pause";
  elements.focusCountdownTask.textContent = `Focusing on "${task}"`;
  elements.focusCountdownTime.textContent = formatCountdown(focusTimer.totalSeconds);

  stopFocusTimerInterval();
  focusTimer.intervalId = setInterval(tickFocusCountdown, 1000);
}

function save() {
  writeStoredValue(storageKey, settings);
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

function updateAssistantModeLabel() {
  elements.assistantModeLabel.textContent = settings.useChatGpt ? "ChatGPT" : "Offline coach";
}

function welcomeMessage() {
  if (!settings.useChatGpt) {
    return "I’m your private, offline focus coach. Ask me for a plan, a task suggestion, or a little momentum.";
  }
  return settings.openaiApiKey
    ? "I’m connected to ChatGPT. Ask me for a plan, a task suggestion, or a little momentum."
    : "I’m your online assistant, powered by ChatGPT. Add your OpenAI API key in Settings to start chatting, or turn the toggle off to use the offline coach.";
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

async function fetchChatGptReply(message) {
  const openTasks = settings.tasks.filter((task) => !task.completed).map((task) => task.text);
  const systemPrompt = `You are a warm, concise productivity coach embedded in a browser new-tab dashboard. The user's name is "${settings.name || "unknown"}", their focus for today is "${settings.focus || "not set"}", and their open tasks are: ${openTasks.length ? openTasks.join(", ") : "none"}. Keep replies under 100 words.`;

  const history = assistantMessages.slice(-8).map((entry) => ({
    role: entry.role === "user" ? "user" : "assistant",
    content: entry.text,
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.openaiModel || "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `OpenAI request failed (${response.status})`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("OpenAI returned an empty response.");
  return reply;
}

async function handleAssistantMessage(message) {
  addAssistantMessage("user", message);

  if (!settings.useChatGpt) {
    addAssistantMessage("assistant", createAssistantReply(message));
    return;
  }

  if (!settings.openaiApiKey) {
    addAssistantMessage(
      "error",
      "Add your OpenAI API key in Settings to use ChatGPT, or turn the toggle off to use the offline coach.",
    );
    return;
  }

  assistantMessages.push({ role: "pending", text: "Thinking…" });
  renderAssistant();

  try {
    const reply = await fetchChatGptReply(message);
    assistantMessages.pop();
    addAssistantMessage("assistant", reply);
  } catch (error) {
    assistantMessages.pop();
    addAssistantMessage("error", `ChatGPT request failed: ${error.message}`);
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

elements.useChatGpt.addEventListener("change", () => {
  settings.useChatGpt = elements.useChatGpt.checked;
  save();
  updateAssistantModeLabel();
});

elements.openaiKey.addEventListener("input", () => {
  settings.openaiApiKey = elements.openaiKey.value.trim();
  save();
});

elements.openaiModel.addEventListener("change", () => {
  settings.openaiModel = elements.openaiModel.value;
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

readStoredValue(storageKey, (settingsResult) => {
  readStoredValue(assistantStorageKey, (assistantResult) => {
    settings = { ...defaults, ...(settingsResult[storageKey] || {}) };
    assistantMessages = Array.isArray(assistantResult[assistantStorageKey])
      ? assistantResult[assistantStorageKey]
      : [];
    if (!Array.isArray(settings.focusHistory)) settings.focusHistory = [];
  if (!Array.isArray(settings.links)) settings.links = [];
  elements.focus.value = settings.focus;
  elements.name.value = settings.name;
  elements.twentyFourHour.checked = settings.use24Hour;
  elements.useChatGpt.checked = settings.useChatGpt;
  elements.openaiKey.value = settings.openaiApiKey;
  elements.openaiModel.value = settings.openaiModel;
  elements.musicVolume.value = settings.musicVolume;
  elements.musicTrack.value = settings.musicTrack;
  updateAssistantModeLabel();
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
