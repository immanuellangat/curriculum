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
};

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
  elements.focus.value = settings.focus;
  elements.name.value = settings.name;
  elements.twentyFourHour.checked = settings.use24Hour;
  elements.useChatGpt.checked = settings.useChatGpt;
  elements.openaiKey.value = settings.openaiApiKey;
  elements.openaiModel.value = settings.openaiModel;
  updateAssistantModeLabel();
  document.querySelector("#quote").textContent = quotes[new Date().getDate() % quotes.length];
  renderClock();
  renderTasks();
  renderAssistant();
  if (!assistantMessages.length) {
    addAssistantMessage("assistant", welcomeMessage());
  }
  setInterval(renderClock, 1000);
  });
});
