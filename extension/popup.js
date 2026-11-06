// SPDX-License-Identifier: GPL-3.0-or-later
const api = typeof browser !== 'undefined' ? browser : chrome;

// footer buttons are hidden if this is empty
const REPO_URL = 'https://github.com/0yarui/anilist-auto-like';

const DEFAULTS = {
  minDelay: 1500,
  maxDelay: 4000,
  maxLikes: 0,
  autoScroll: true,
  blacklist: [],
  lang: 'auto',
  preset: 'careful',
  reqPerMin: 25,
  homeFeed: 'following',
};
const PRESETS = { careful: [1500, 4000], fast: [1000, 2000], turbo: [100, 300] };

const $ = (id) => document.getElementById(id);
let settings = { ...DEFAULTS };
const tr = (key, vars) => t(settings.lang, key, vars);

// i18n
function applyI18n() {
  document.documentElement.lang = resolveLang(settings.lang);
  const auto = $('lang').querySelector('option[value="auto"]');
  if (auto) auto.textContent = tr('autoDetect');
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = tr(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = tr(el.dataset.i18nPh)));
  $('lang').setAttribute('aria-label', tr('language'));
}

// settings
function fillInputs() {
  $('minDelay').value = settings.minDelay / 1000;
  $('maxDelay').value = settings.maxDelay / 1000;
  $('maxLikes').value = settings.maxLikes;
  $('reqPerMin').value = settings.reqPerMin;
  $('homeFeed').value = settings.homeFeed;
  $('autoScroll').checked = settings.autoScroll;
}

function presetFor(min, max) {
  return Object.keys(PRESETS).find((k) => PRESETS[k][0] === min && PRESETS[k][1] === max) || 'custom';
}

function renderPreset() {
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('active', b.dataset.preset === settings.preset));
  const hint = $('presetHint');
  const key = { careful: 'hintCareful', fast: 'hintFast', turbo: 'hintTurbo' }[settings.preset];
  hint.textContent = key ? tr(key) : '';
  hint.classList.toggle('warn', settings.preset === 'turbo');
}

function saveInputs() {
  settings.minDelay = Math.max(100, Math.round(Number($('minDelay').value) * 1000) || DEFAULTS.minDelay);
  settings.maxDelay = Math.max(100, Math.round(Number($('maxDelay').value) * 1000) || DEFAULTS.maxDelay);
  settings.maxLikes = Math.max(0, parseInt($('maxLikes').value, 10) || 0);
  settings.reqPerMin = Math.min(120, Math.max(1, parseInt($('reqPerMin').value, 10) || DEFAULTS.reqPerMin));
  settings.homeFeed = $('homeFeed').value === 'global' ? 'global' : 'following';
  settings.autoScroll = $('autoScroll').checked;
  settings.preset = presetFor(settings.minDelay, settings.maxDelay);
  renderPreset();
  return api.storage.local.set(settings);
}

async function loadSettings() {
  settings = { ...DEFAULTS, ...(await api.storage.local.get(DEFAULTS)) };
  if (settings.lang !== 'auto' && !LANGS[settings.lang]) settings.lang = 'auto';
}

// blacklist
function renderList() {
  const ul = $('list');
  ul.textContent = '';
  settings.blacklist.forEach((u) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = u;
    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.addEventListener('click', async () => {
      settings.blacklist = settings.blacklist.filter((x) => x !== u);
      await api.storage.local.set({ blacklist: settings.blacklist });
      renderList();
    });
    li.append(name, rm);
    ul.appendChild(li);
  });
}

async function addUser() {
  const u = $('newUser').value.trim().replace(/^@/, '').toLowerCase();
  if (!u || settings.blacklist.includes(u)) return;
  settings.blacklist.push(u);
  await api.storage.local.set({ blacklist: settings.blacklist });
  $('newUser').value = '';
  renderList();
}

// account
async function refreshAccount() {
  const s = await api.storage.local.get({ anilistToken: '', tokenExp: 0, viewerName: '', clientId: '' });
  const connected = !!s.anilistToken && s.tokenExp > Date.now();
  $('viewSetup').hidden = connected;
  $('viewMain').hidden = !connected;
  $('acctName').textContent = connected ? tr('connectedAs', { name: s.viewerName }) : '';
  if (!$('clientId').value) $('clientId').value = s.clientId || '';
  try {
    $('redirectUrl').textContent = api.identity.getRedirectURL();
  } catch (_) {
    $('redirectUrl').textContent = '';
  }
  return connected;
}

async function connectAccount() {
  const clientId = $('clientId').value.trim();
  $('acctError').textContent = '';
  if (!/^\d+$/.test(clientId)) {
    $('acctError').textContent = tr('errClientId');
    return;
  }
  $('connect').disabled = true;
  $('connect').textContent = tr('connecting');
  let res;
  try {
    res = await api.runtime.sendMessage({ type: 'connect', clientId });
  } catch (e) {
    res = { ok: false, error: String((e && e.message) || e) };
  }
  $('connect').disabled = false;
  $('connect').textContent = tr('connect');
  if (res && res.ok) {
    await refreshAccount();
    await updateStatus();
  } else {
    $('acctError').textContent = tr('errConnect', { msg: (res && res.error) || 'unknown' });
  }
}

// talking to the AniList tab
async function activeTab() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (_) {
    return null;
  }
}

async function send(tabId, type) {
  try {
    return (await api.tabs.sendMessage(tabId, { type })) || null;
  } catch (_) {
    return null;
  }
}

async function updateStatus() {
  const tab = await activeTab();
  const onAniList = !!(tab && /^https:\/\/anilist\.co\//.test(tab.url || ''));
  const res = tab ? await send(tab.id, 'status') : null;
  const btn = $('toggle');
  const status = $('status');
  btn.classList.toggle('btn-danger', !!(res && res.running));
  btn.classList.toggle('btn-primary', !(res && res.running));
  btn.textContent = res && res.running ? tr('stop') : tr('likePosts');
  status.classList.remove('warn');
  if (!res) {
    // not on AniList: ask to open it. On AniList but no content script: the page needs a refresh
    status.textContent = onAniList ? tr('reload') : tr('openPage');
    status.classList.toggle('warn', onAniList);
  } else {
    status.textContent = res.running ? (res.waiting > 2 ? tr('waiting', { s: res.waiting }) : `${tr('liking')} (${res.likedCount})`) : '';
  }
  return res;
}

// footer links
function setupRepoLinks() {
  if (!REPO_URL) return;
  $('repoLinks').hidden = false;
  $('reportIssue').href = `${REPO_URL}/issues/new/choose`;
  $('github').href = REPO_URL;
}

// events
document.querySelectorAll('#presets button').forEach((b) =>
  b.addEventListener('click', async () => {
    const [min, max] = PRESETS[b.dataset.preset];
    settings.minDelay = min;
    settings.maxDelay = max;
    settings.preset = b.dataset.preset;
    fillInputs();
    renderPreset();
    await api.storage.local.set(settings);
  })
);

['minDelay', 'maxDelay', 'maxLikes', 'reqPerMin', 'homeFeed', 'autoScroll'].forEach((id) => $(id).addEventListener('change', saveInputs));

$('toggle').addEventListener('click', async () => {
  const tab = await activeTab();
  const cur = tab ? await send(tab.id, 'status') : null;
  if (!cur) {
    await updateStatus(); // shows "open an AniList page" or "refresh the AniList page"
    return;
  }
  await saveInputs();
  await send(tab.id, cur.running ? 'stop' : 'start');
  await updateStatus();
});

$('add').addEventListener('click', addUser);
$('newUser').addEventListener('keydown', (e) => e.key === 'Enter' && addUser());
$('connect').addEventListener('click', connectAccount);
$('clientId').addEventListener('keydown', (e) => e.key === 'Enter' && connectAccount());

$('disconnect').addEventListener('click', async () => {
  await api.runtime.sendMessage({ type: 'disconnect' });
  await refreshAccount();
});

$('copyRedirect').addEventListener('click', async () => {
  const text = $('redirectUrl').textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const r = document.createRange();
    r.selectNodeContents($('redirectUrl'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand('copy');
  }
  $('copyRedirect').textContent = '✓';
  setTimeout(() => ($('copyRedirect').textContent = tr('copy')), 1200);
});

// reset needs two clicks; keeps the account and the language
let resetArmed = false;
let resetTimer = null;
$('reset').addEventListener('click', async () => {
  if (!resetArmed) {
    resetArmed = true;
    $('reset').textContent = tr('resetConfirm');
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetArmed = false;
      $('reset').textContent = tr('resetSettings');
    }, 3000);
    return;
  }
  clearTimeout(resetTimer);
  resetArmed = false;
  settings = { ...DEFAULTS, lang: settings.lang };
  await api.storage.local.set(settings);
  fillInputs();
  renderPreset();
  renderList();
  $('reset').textContent = tr('resetSettings');
});

$('lang').addEventListener('change', async () => {
  settings.lang = $('lang').value;
  await api.storage.local.set({ lang: settings.lang });
  resetArmed = false;
  applyI18n();
  renderPreset();
  await refreshAccount();
  await updateStatus();
});

// start
(async () => {
  await loadSettings();
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  $('lang').appendChild(autoOpt);
  Object.entries(LANGS).forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    $('lang').appendChild(opt);
  });
  $('lang').value = settings.lang;
  applyI18n();
  fillInputs();
  renderPreset();
  renderList();
  setupRepoLinks();
  const connected = await refreshAccount();
  if (connected) await updateStatus();
  setInterval(() => {
    if (!$('viewMain').hidden) updateStatus();
  }, 1000);
})();
