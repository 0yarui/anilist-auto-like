# Firefox Add-ons (AMO) listing

Paste each block into the matching field on addons.mozilla.org.

## Name
AniList Auto-Like

## Summary (max 250 characters)
Automatically likes activity-feed posts on AniList (home and profiles) at an adjustable pace. Speed presets, user blacklist, goes through older posts by itself, 10 interface languages. Unofficial; needs a free AniList API client.

## Description
AniList Auto-Like likes the activity-feed posts on your AniList home feed and on user profiles, so you can support your friends without clicking every heart.

FEATURES
• "Like" button inside the AniList navigation bar, plus a toolbar popup with a step-by-step account setup
• Works on your home feed (Following or Global) and on profiles (/user/name)
• Keeps going through older posts by itself, with no scrolling or "Load more" clicks
• Skips posts you already liked and never removes an existing like
• Speed presets (Careful, Fast, Turbo), custom delays, optional limit per run
• Blacklist: skip posts from chosen users
• Instant Stop, Disconnect account and Reset settings
• Interface in 10 languages: English (default), Español, Português (Brasil), Français, Deutsch, Italiano, 日本語, 한국어, Русский, 中文（简体）

ONE-TIME SETUP
AniList only lets extensions act on your behalf through its official API, so you connect once with your own free API client. The popup guides you:
1. Click "Open AniList developer settings" and "Create New Client".
2. Paste the Redirect URL shown in the popup, save, and copy the Client ID.
3. Paste the Client ID in the popup and click Connect.
You do not need the Client Secret; the extension never asks for it.

USAGE WARNINGS
• Unofficial. Not affiliated with or endorsed by AniList. Use at your own risk.
• No setting is guaranteed risk-free. AniList has not published rules about automated likes, and large numbers of likes in a row can look like spam and may be reported to AniList staff.
• Rate limit: the AniList API currently allows 30 requests per minute (normally 90), shared with the AniList website. The extension uses one request per like and stays under a cap of 25 per minute. If AniList answers "Too Many Requests", it waits the time AniList asks for and continues. Exceeding the limit triggers a 1-minute timeout.

RECOMMENDED SETTINGS
• Careful (default): 1.5 to 4 seconds between likes, and a limit of 50 to 100 likes per run. About 15 to 18 likes per minute, similar to fast manual clicking. This is the recommended preset.
• Fast, for people who do not mind how it looks: 1 to 2 seconds between likes, no limit per run. About 24 likes per minute, close to the API limit.
• Turbo (experimental): starts as fast as possible and slows down as soon as AniList says "Too Many Requests". Today it ends up about as fast as Fast; it is only quicker if AniList raises its limit again. Both Fast and Turbo are more likely to be reported as spam: use them in short runs, not for hours.
Numbers are estimates, not measurements.

SECURITY AND PRIVACY
Everything is stored locally in your browser: your Client ID, the access token AniList issues (it can act as your account, so keep your computer secure), your username and your settings. The only servers contacted are AniList's (anilist.co and graphql.anilist.co). No analytics, nothing sent to the developer. "Disconnect account" deletes the token, and you can also revoke it in your AniList settings. The source code is not minified.

SUPPORT AND SOURCE CODE
https://github.com/0yarui/anilist-auto-like
Licensed under GPL-3.0-or-later.

## Categories
Social & Communication

## Tags
anilist, anime, manga, social, likes

## Support site
https://github.com/0yarui/anilist-auto-like

## Privacy policy URL
https://github.com/0yarui/anilist-auto-like/blob/main/PRIVACY.md

## Notes to reviewers
The extension needs an AniList account and a personal API client to test:
1. Create a client at https://anilist.co/settings/developer.
2. Set its Redirect URL to the value shown in the extension popup.
3. Enter the Client ID in the popup and click Connect (OAuth implicit grant through browser.identity.launchWebAuthFlow). The token is stored in storage.local.
4. Open https://anilist.co/home and click the "Like" button in the navigation bar, or "Like Posts" in the popup.
Permissions: "storage" (settings and token), "identity" (login window), host permissions graphql.anilist.co (API calls) and anilist.co (content script, and reading the active tab URL from the popup to ask the user to open or refresh an AniList page). The code is not minified or obfuscated; it is the same as the repository.

## Data declaration
The manifest declares data_collection_permissions required ["authenticationInfo"]: the extension keeps an AniList access token in storage.local and sends it only to AniList's own API (graphql.anilist.co). Nothing goes to the developer or to any other server. Add-on ID: anilist-autolike@addon (AMO checks that it is unique on first upload; if it is taken, change it in manifest.json).
