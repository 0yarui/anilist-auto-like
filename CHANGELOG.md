# Changelog

## 1.5.8
- Removed the gecko_android key (it made addons.mozilla.org mark Firefox for Android as compatible and lock the checkbox); the minimum Firefox version is now 142, which supports the data collection declaration

## 1.5.7
- Add-on ID changed to anilist-autolike@0yarui (the previous ID was already registered on addons.mozilla.org). The Redirect URL changes with it: copy the new one from the popup into your API client

## 1.5.6
- Firefox for Android minimum set to 142, the first version that supports the data collection declaration (fixes the validator warning on addons.mozilla.org)

## 1.5.5
- Manifest description no longer mentions auto-scroll (the extension never scrolls the page)

## 1.5.4
- While AniList's rate limit makes the extension wait, the button, the toast and the popup show a countdown ("Resuming in 42s") instead of looking frozen
- Setup stays in the toolbar popup (an extra setup window was tried and removed)

## 1.5.2
- Primary buttons (Like Posts, Connect) and the active speed option are AniList blue again
- Title heart is an inline SVG with the same gradient as the title
- Login: the background page is kept alive while the AniList window is open, so the first attempt no longer ends on Firefox's "Server not found" page when the user takes a while to accept

## 1.5.1
- Secondary buttons (GitHub, Report an issue, Open developer settings, Copy, Add) are blue-outlined again, not only on hover
- README: troubleshooting for the "Server not found" page after authorizing

## 1.5.0
- New icon (16 to 128 px) and a popup redesign with a gradient title
- Add-on ID is now anilist-autolike@addon, so the Redirect URL changed: copy the new one from the popup and update your API client
- Data declaration set to authenticationInfo (the access token) and minimum Firefox raised to 140

## 1.4.5
- New heart icon
- Turbo warning now says it is experimental (translated in all languages)
- Code cleanup

## 1.4.4
- Client ID placeholder is now a language-neutral "12345"

## 1.4.3
- New language option "Detect automatically" (now the default): follows the browser language, falls back to English

## 1.4.2
- Fix: AniList's rate-limit (429) responses reach the browser as a plain "NetworkError"; the extension now backs off for a minute, drops to the normal request cap and retries instead of stopping with an error

## 1.4.1
- "Report an issue" and "GitHub" buttons in the popup
- Project homepage added to the manifest

## 1.4.0
- Posts are read page by page from the AniList API: fixes the run stopping when AniList showed "Load more", and no scrolling or clicking is needed
- One request per like and a 25 requests/minute cap by default (AniList currently allows 30/minute)
- New popup: step-by-step account setup, speed presets (Careful / Fast / Turbo), advanced settings, Disconnect account, Reset settings
- Turbo preset: starts as fast as possible and slows down when AniList answers "Too Many Requests"
- Home feed selector (Following / Global); stops when older posts are already liked
- "Refresh the AniList page and try again" message (translated) when the AniList tab was open before connecting or updating
- Real network or API errors are shown instead of "not connected"
- License changed to GPL-3.0-or-later

## 1.3.0
- One-time account connection with your own AniList API client (OAuth), replacing in-page clicks
- Likes are sent through the AniList API; already-liked posts are checked first so nothing is un-liked
- Instant Stop, blacklist, delay and per-run limit settings
- Interface in 10 languages
- Debug panel (with Copy button) when something fails
