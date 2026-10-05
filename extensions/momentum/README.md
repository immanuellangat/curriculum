### Introduction

Focus Plus is a small, dependency-free Chrome new-tab extension inspired
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

The dashboard background crossfades through calm nature photos from Unsplash every minute;
if you are offline, the default gradient stays in place.

The focus timer starts minimized as a small pill above the Focus assistant button. Tap it to
expand it to the center of the screen, and use the close button, the backdrop or Escape to
minimize it. While a session runs, the pill shows the remaining time. The Tasks card works the same way,\nwith its own pill stacked above the focus pill.

The quote under the clock changes every day. There are 65 encouraging quotes that cycle in order,
so each day shows a different one and the list starts over after the last. It also updates at midnight
if the tab stays open.

The **Play** button in the top bar plays and pauses music, and the small ▾ next to it drops down a tile grid (Rainfall, Wind, Noise, Ocean, Beach, Forest,
Stream, Train, Thunder, Fire, Calm tone and Chill radio). Each tile shows a small Unsplash photo (loaded online, with a gradient fallback offline). Tap a tile to start it; the ▶/⏸ button inside the panel pauses and resumes it. The panel also has **YouTube** (Lofi Girl, Chillhop, jazz and piano live streams, nature sounds) and **Spotify** (Deep Focus, Lofi Beats, Peaceful Piano and similar playlists) tabs that play embedded players (YouTube plays through a small player page hosted on this project's GitHub Pages, because YouTube refuses to embed directly inside extension pages); they need an internet connection, Spotify plays full tracks only when you are logged in to Spotify in Chrome (otherwise 30-second previews), and starting one stops the built-in sound.

Rain, Wind, Ocean, Beach, Forest, Stream, Train and Thunder use real field recordings bundled in the `sounds/` folder, looped with a crossfade so
there is no audible gap, and fall back to synthesized noise if a file can't load. White noise is
generated as softer pink noise, and Fire is synthesized (soft embers plus random crackles) so it has no background hiss. Sound credits, from Wikimedia Commons:

- `rain.ogg`: "Rain (1)", public domain.
- `wind.ogg`: "Wind in Swedish pine forest at 25 mps", CC BY-SA 4.0.
- `ocean.ogg`: "Oceanwavescrushing", CC BY 3.0.
- `beach.ogg`: "On a pebble beach", public domain.
- `forest.ogg`: "Birds forest", public domain.
- `stream.ogg`: "Shallow small river with stony riverbed", public domain.
- `train.ogg`: "Taiwan railways EP727 train cars sounds", CC0.
- `thunder.ogg`: "rbh-thunder-storm" by Richard Humphries, CC BY 3.0.

The 🚫 **Site Blocker** button in the top bar opens a list of blocked groups (Social Media, Entertainment,
News, Shopping and Email). Switch a group on or off, open its arrow to edit the websites in it, or add your own
group. The master switch at the top of the panel (also in the **Focus** tab in **Settings**) turns blocking
on or off, and Chrome asks for extra permission the first time you enable it. While a focus session is
running, sites in the enabled groups and their subdomains show a "stay focused" page; the block lifts when
the session ends or is stopped, and that page has an **Unblock sites** button as an escape hatch.

The **Focus** tab also has **Tab Stash**, which saves your other open tabs in the current window (pinned tabs are kept) and closes them, either
automatically when a focus session starts or with **Stash open tabs now**. Use **Restore all** to reopen them.
The stash is stored locally and is not synced between profiles.

### Knowledge check

The following questions are an opportunity to reflect on key topics in this lesson. If you can't answer a question, click on it to review the material, but keep in mind you are not expected to memorize or master this knowledge.

- Did you load the extension from the `extensions/momentum` directory?
