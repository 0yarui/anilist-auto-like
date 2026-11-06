// SPDX-License-Identifier: GPL-3.0-or-later
// AniList login. It lives here because the popup closes when the login window opens.
const api = typeof browser !== 'undefined' ? browser : chrome;

const API_URL = 'https://graphql.anilist.co';

// Firefox suspends idle background pages after ~30 s. Logging in takes longer than that when
// the user has to read and accept AniList's permission page, so ping an API while it is open.
async function connect(clientIdRaw) {
  const keepAlive = setInterval(() => api.storage.local.get('clientId').catch(() => {}), 10000);
  try {
    return await login(clientIdRaw);
  } finally {
    clearInterval(keepAlive);
  }
}

async function login(clientIdRaw) {
  const clientId = String(clientIdRaw || '').trim();
  if (!/^\d+$/.test(clientId)) return { ok: false, error: 'badClientId' };

  const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&response_type=token`;
  let redirected;
  try {
    redirected = await api.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }

  let params;
  try {
    const u = new URL(redirected);
    params = new URLSearchParams(u.hash.replace(/^#/, '') || u.search);
  } catch (_) {
    return { ok: false, error: 'invalid redirect' };
  }
  const token = params.get('access_token');
  if (!token) return { ok: false, error: params.get('error_description') || params.get('error') || 'no token received' };

  let viewer = null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: 'query{Viewer{id name}}' }),
    });
    const json = await res.json();
    viewer = json && json.data && json.data.Viewer;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  if (!viewer) return { ok: false, error: 'AniList did not accept the token' };

  const expiresIn = Number(params.get('expires_in')) || 365 * 24 * 3600;
  await api.storage.local.set({
    anilistToken: token,
    tokenExp: Date.now() + expiresIn * 1000,
    viewerName: viewer.name,
    clientId,
  });
  return { ok: true, name: viewer.name };
}

api.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'connect') return connect(msg.clientId);
  if (msg && msg.type === 'disconnect') {
    return api.storage.local.remove(['anilistToken', 'tokenExp', 'viewerName']).then(() => ({ ok: true }));
  }
});
