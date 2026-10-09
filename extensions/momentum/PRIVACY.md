<!-- markdownlint-disable MD041 TOP004 -->

# Focus Plus privacy policy

Last updated: October 2026

Focus Plus is a Chrome new-tab extension. It has no account system, no analytics and no advertising, and the developer does not collect or receive any of your data.

## What is stored on your device

- Your settings, name, tasks, focus history, quick links, blocked-site groups and stashed tabs are stored in your browser with `chrome.storage`.
- Non-secret settings are saved with `chrome.storage.sync`, so Chrome may sync them across your signed-in devices. API keys and focus history are kept locally only.
- You can remove everything by uninstalling the extension.

## What is sent to other services

- **AI assistant (optional).** If you add an API key and use the assistant, the messages you type are sent directly from your browser to the provider you chose: OpenAI, DeepSeek or Google Gemini. Their own privacy policies apply. Nothing is sent unless you use the assistant.
- **Background photos.** The new tab page loads photos from images.unsplash.com.
- **Music.** The Chill radio tile streams from somafm.com. The YouTube and Spotify tabs show embedded players from YouTube (through a player page on this project's GitHub Pages site) and Spotify, which may set their own cookies and collect data under their own policies.

## Permissions

- `storage`: save your settings and tasks.
- `tabs`: read tab titles and addresses only to stash open tabs when you ask or when a focus session starts.
- `contentSettings`: block website notifications during focus, if you turn that on.
- `declarativeNetRequest` and optional access to all sites: redirect sites on your blocked list to a "stay focused" page. Site access is requested only when you turn the blocker on, and the blocked list is never sent anywhere.
- Access to api.openai.com, api.deepseek.com and generativelanguage.googleapis.com: only to talk to the AI provider you choose.

## Data sharing

Focus Plus does not sell or share user data with third parties, and does not use it for purposes unrelated to the features above.

## Contact

Open an issue at <https://github.com/immanuellangat/focus-plus/issues>.
