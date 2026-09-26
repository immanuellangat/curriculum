### Introduction

Momentum Focus is a small, dependency-free Chrome new-tab extension inspired
by the calm dashboard experience of Momentum.

It shows the current time and date, a rotating quote, a daily focus prompt, and
a local to-do list.

### Lesson overview

This section contains a general overview of topics that you will learn in this lesson.

- How to load the extension in Chrome.
- How to use the dashboard and its local settings.
- How to use the built-in ChatGPT-powered focus assistant.
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

Settings and tasks are stored with `chrome.storage.local`, so nothing is sent
to a server. To update the extension after editing, use **Reload** on its card
in `chrome://extensions`.

</div>

### How it works

The dashboard runs entirely in the browser and keeps preferences in local Chrome storage.
The focus assistant is an online assistant by default: it sends your messages to ChatGPT
once you add your own OpenAI API key in **Settings**.

Open **Settings**, paste your key under **OpenAI API key**, and pick a model. The key is
stored only in `chrome.storage.local` on your device and is sent directly to
`https://api.openai.com` with each message, never through any other server. Turn off
**Connect to ChatGPT** at any time to switch to a rule-based offline coach that never
sends messages or personal data over the network.

The play button in the top-left corner offers focus music. Rain, white noise, wind, and
calm tone are generated in the browser with the Web Audio API, so they work fully offline.
**Chill radio (online)** instead streams a free lofi/chillout internet radio station
(SomaFM's Groove Salad) and requires an active internet connection.

Type your main focus, pick a session length, and select **Start focus** to begin a
countdown timer. Select **Pause** to hold the countdown and **Resume** to continue, or
**Stop session** to end early. Every session, whether finished or stopped early, is added
to **Focus history** below, which is stored in `chrome.storage.local` so it persists
between visits. Use **Clear history** to remove it.

The 🔗 button in the top-left corner opens a quick-links menu. Add a name and URL to
save a shortcut, click a saved link to open it in a new tab, and use **×** to remove it.
The same list is also editable from the **Links** tab in **Settings**, since both share
the same saved data.

**Settings** is organized into tabs — **General**, **Links**, and **AI assistant** — so
related options are grouped together instead of one long scrolling list.

### Knowledge check

The following questions are an opportunity to reflect on key topics in this lesson. If you can't answer a question, click on it to review the material, but keep in mind you are not expected to memorize or master this knowledge.

- Did you load the extension from the `extensions/momentum` directory?
