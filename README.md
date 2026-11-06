<p align="center"><img src="store/icon-512.png" width="96" alt="AniList Auto-Like icon"></p>

# AniList Auto-Like

Firefox extension that automatically likes activity-feed posts on [AniList](https://anilist.co), on your **home feed** and on **user profiles**, at an adjustable pace.

> **Unofficial.** Not affiliated with or endorsed by AniList. Use at your own risk. Read [Usage warnings](#usage-warnings) first.

## Features

- **Like** button inside the AniList navigation bar, plus a toolbar popup with a step-by-step account setup
- Works on `/home` (Following or Global feed) and on profiles (`/user/name`)
- Reads posts page by page from the AniList API, so it keeps going through older posts without scrolling or clicking "Load more"
- Skips posts you already liked and never removes an existing like
- Speed presets **Careful / Fast / Turbo**, custom delays, limit per run, request cap per minute
- User blacklist, instant **Stop**, **Disconnect account** and **Reset settings**
- Interface in 10 languages: English (default), Español, Português (Brasil), Français, Deutsch, Italiano, 日本語, 한국어, Русский, 中文（简体）

## Install

- **Firefox Add-ons:** _link coming once published_
- **From source (temporary, removed when Firefox closes):**
  1. Download this repository.
  2. Open `about:debugging#/runtime/this-firefox`.
  3. Click **Load Temporary Add-on…** and select `extension/manifest.json`.

Requires Firefox 140 or newer.

## One-time setup

AniList only lets extensions act on your behalf through its official API, so you connect once with **your own free API client**. The popup guides you through it:

1. Click **Open AniList developer settings** and then **Create New Client**.
2. Give it any name. In **Redirect URL**, paste the address shown in the popup (button **Copy**) and click **Save**.
3. Copy the **Client ID** (a number), paste it into the popup and click **Connect**. Authorize in the AniList window.
4. The popup now says **Connected as your-username**. Reload your AniList tab (F5) and try again.

You do **not** need the Client Secret; the extension never asks for it.

## Usage

1. Open `https://anilist.co/home` or a profile.
2. Click **Like** in the AniList navigation bar (or **Like Posts** in the popup).
3. Click the same button (now **Stop**) to stop at any time.

## Speed settings

AniList's API currently allows **30 requests per minute** (normally 90), and the AniList website itself shares that limit. The extension uses one request per like and keeps to a cap of 25 requests per minute by default.

| Preset | Delay between likes | Approx. likes/min | Notes |
| --- | --- | --- | --- |
| **Careful** (default) | 1.5 – 4 s | 15 – 18 | Recommended. Suggested limit per run: 50 – 100 likes |
| **Fast** | 1 – 2 s | about 24 | Close to the API limit |
| **Turbo** (experimental) | 0.1 – 0.3 s | about 24 today | Starts as fast as possible and slows down as soon as AniList answers "Too Many Requests". Faster than Fast only if AniList raises its limit again |

Going faster than the API limit is not possible: exceeding it only triggers a 1-minute timeout from AniList. Numbers are estimates, not measurements.

## Usage warnings

- **No setting is guaranteed risk-free.** AniList has not published rules about automated likes. Very large numbers of likes in a row can look like spam and may be reported to AniList staff.
- **Careful** is meant to resemble fast manual clicking and is the recommended preset.
- **Fast** and **Turbo** are for people who do not mind how it looks. Expect a higher chance of reports; use them in short runs, not all day.
- Likes are not undone in bulk. To remove likes you must unlike them manually on AniList.
- Do not use this to harass, to farm likes, or to circumvent AniList's [terms of use](https://docs.anilist.co/guide/terms-of-use).

## Security

- The extension only talks to AniList (`anilist.co` and `graphql.anilist.co`). There is no server of its own and no analytics.
- Connecting gives the extension an AniList **access token**. AniList tokens are not limited to specific actions, so anyone who got hold of the token could act as your account. It is stored only in the extension's local storage and is sent only to `graphql.anilist.co`. It expires after about one year.
- **Disconnect account** deletes the token from your browser. You can also revoke it on AniList (Settings, Apps) or delete your API client on the developer page, which invalidates its tokens.
- Your **Client Secret** is never used. Do not share it, and do not paste screenshots that show it.
- The code is plain, readable JavaScript (no minification, no remote code). Permissions requested: `storage` (settings and token), `identity` (the AniList login window), and access to `anilist.co` and `graphql.anilist.co`.
- Keep your computer and Firefox profile secure: like any browser extension, stored data is not encrypted on disk.

## Privacy

Everything stays in your browser. See [PRIVACY.md](PRIVACY.md).

## Troubleshooting

- **"Not connected to AniList"**: open the popup and complete the one-time setup.
- **"Refresh the AniList page and try again"**: the AniList tab was open before the extension was installed, updated or connected. Press F5 on it.
- **"Server not found" page after authorizing**: the Redirect URL saved in your AniList API client is not the one shown in the popup (it changes if the extension ID changes). Edit the client, paste the current address from step 3 and save. If the address bar of that tab shows `#access_token=`, close the tab and clear it from your history.
- **Popup says "Open an AniList page"**: switch to an AniList tab first.
- **A debug panel appeared**: click **Copy** and include the text in your issue. It never contains your token.
- **Likes pause for about a minute**: AniList's rate limit was reached (the website shares the same limit, so browsing AniList at the same time makes it more likely). The button shows "Stop (8) · 42s" while it waits and the extension resumes by itself.

## Reporting issues

Use [GitHub Issues](https://github.com/0yarui/anilist-auto-like/issues/new/choose). Include your extension version, Firefox version and the debug text if a panel appeared. **Never post your access token or Client Secret.**

## Development

No build step, plain JavaScript. Files in `extension/`:

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 (Firefox) |
| `background.js` | One-time OAuth login (implicit grant) |
| `content.js` | Runs on anilist.co: reads posts from the API page by page and likes them |
| `popup.html`, `popup.js` | Toolbar popup: account setup, speed, settings, blacklist, language |
| `i18n.js` | Translations (add a language by adding a block to `I18N` and an entry to `LANGS`) |
| `content.css` | Styles for the in-page button and notifications |

Package with [`web-ext`](https://github.com/mozilla/web-ext): `cd extension && npx web-ext build`.

## License

[GNU General Public License v3.0 or later](LICENSE) (`GPL-3.0-or-later`).
