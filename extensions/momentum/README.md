### Introduction

Momentum Focus is a small, dependency-free Chrome new-tab extension inspired
by the calm dashboard experience of Momentum.

It shows the current time and date, a rotating quote, a daily focus prompt, and
a local to-do list.

### Lesson overview

This section contains a general overview of topics that you will learn in this lesson.

- How to load the extension in Chrome.
- How to use the dashboard and its local settings.
- How to use the built-in focus assistant, powered by ChatGPT, DeepSeek, or Gemini.
- How to switch to the private offline coach when you prefer not to use the network.
- How to play focus music, including an online chill radio stream.
- How to run a focus countdown and review your session history.

### Install locally

1. Open `chrome://extensions` in Chrome.
1. Enable **Developer mode**.
1. Select **Load unpacked**.
1. Choose this `extensions/momentum` directory.
1. Open a new tab to see the dashboard.

### Assignment

<div class="lesson-content__panel" markdown="1">

Settings and tasks are stored with `chrome.storage.local` (and, apart from API keys and
focus history, mirrored to `chrome.storage.sync` so they follow your Google account across
Chrome profiles where the extension is installed). Nothing is sent to a server of ours. To
update the extension after editing, use **Reload** on its card in `chrome://extensions`.

</div>

### How it works

The dashboard runs entirely in the browser and keeps preferences in local Chrome storage.
The focus assistant supports four modes, chosen from the **Assistant** dropdown in the
**AI assistant** settings tab: **ChatGPT (OpenAI)**, **DeepSeek**, **Gemini (Google)**, or
the private **Offline coach**.

Pick ChatGPT, DeepSeek, or Gemini, paste your own API key for that provider, and choose a
model. Each key is stored only in `chrome.storage.local` on your device and is sent
directly to that provider (`https://api.openai.com`, `https://api.deepseek.com`, or
`https://generativelanguage.googleapis.com`) with each message, never through any other
server. Switch the dropdown to **Offline coach** at any time to use a rule-based assistant
that never sends messages or personal data over the network.

The play button in the top-left corner offers focus music. Rain, white noise, wind, and
calm tone are generated in the browser with the Web Audio API, so they work fully offline.
**Chill radio (online)** instead streams a free lofi/chillout internet radio station
(SomaFM's Groove Salad) and requires an active internet connection.

Type your main focus, pick a session length (or choose **Custom...** to enter your own
desired minutes), and select **Start focus** to begin a countdown timer. Select **Pause**
to hold the countdown and **Resume** to continue, or **Stop session** to end early. Every
session, whether finished or stopped early, is added to **Focus history** below, which is
stored in `chrome.storage.local` so it persists between visits. Use **Clear history** to
remove it.

The 🔗 button in the top-left corner opens a quick-links menu. Add a name and URL to
save a shortcut, click a saved link to open it in a new tab, and use **×** to remove it.
The same list is also editable from the **Links** tab in **Settings**, since both share
the same saved data.

Starting a focus session also silences browser notification pop-ups from other sites,
so nothing interrupts you. Look for the **🔕 Notifications paused** note under the
countdown while a session is active — this can be turned off from the **Focus** tab
in **Settings** if you'd rather keep notifications on.

**Settings** is organized into tabs — **General**, **Focus**, **Links**, and **AI
assistant** — so related options are grouped together instead of one long scrolling list.

### Knowledge check

The following questions are an opportunity to reflect on key topics in this lesson. If you can't answer a question, click on it to review the material, but keep in mind you are not expected to memorize or master this knowledge.

- Did you load the extension from the `extensions/momentum` directory?
