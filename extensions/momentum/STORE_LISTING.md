<!-- markdownlint-disable MD041 TOP004 -->

# Chrome Web Store listing notes

Copy these into the Developer Dashboard when you submit.

## Single purpose

A new-tab dashboard that helps you focus: daily focus timer, tasks, ambient sounds, a site blocker and an optional AI focus coach.

## Permission justifications

- `storage`: saves settings, tasks and focus history.
- `tabs`: reads tab titles and addresses to stash open tabs when the user starts a focus session or taps "Stash open tabs now".
- `contentSettings`: blocks website notifications during focus when the user enables it.
- `declarativeNetRequest`: redirects sites on the user's blocked list to a local "stay focused" page.
- Optional host permission `<all_urls>`: requested only when the user turns the site blocker on, because blocked sites can be any domain the user chooses.
- Host permissions for api.openai.com, api.deepseek.com and generativelanguage.googleapis.com: send the user's assistant messages to the provider they selected.
- `web_accessible_resources` (`blocked.html`): lets the redirect to the "stay focused" page work on blocked sites.

## Remote code

None. All JavaScript is bundled. YouTube and Spotify are shown in iframes.

## Data usage disclosures

- Collects: website content (assistant messages the user types, only when the assistant is used) and web history (tab addresses, kept on the device only).
- Not sold, not used for unrelated purposes, not used for creditworthiness or lending.
- Privacy policy URL: <https://immanuellangat.github.io/focus-plus/PRIVACY.html>

## Before submitting

- Take 1280x800 screenshots of the new tab page, the Sounds panel and the settings.
- Upload the 128 px icon from `icons/` as the store icon.
- Zip the extension folder without `README.md`, `STORE_LISTING.md` and `PRIVACY.md`.
