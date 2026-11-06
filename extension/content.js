// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  // after reloading the extension an old copy can linger in open tabs, only the newest one runs
  const INSTANCE = String(Math.random());
  document.documentElement.dataset.alkInstance = INSTANCE;
  const isCurrent = () => document.documentElement.dataset.alkInstance === INSTANCE;

  // DOM selectors, only for the nav button and the red hearts
  const SEL = {
    entry: '.activity-entry',
    likeBtn: '.like-wrap .button',
    nav: '.nav-wrap .nav .links, .nav .links',
  };

  // posts come straight from the API, so no scrolling or "Load more" clicking
  const API_URL = 'https://graphql.anilist.co';
  const PAGE_SIZE = 50;
  const TURBO_CAP = 85; // Turbo starts here and drops to the normal cap after the first 429
  const CAUGHT_UP_PAGES = 3; // give up after this many pages in a row with nothing new
  const ACT =
    '... on TextActivity{id isLiked user{name}} ... on ListActivity{id isLiked user{name}} ... on MessageActivity{id isLiked messenger{name}}';
  const pageQuery = (vars, args) =>
    `query($page:Int${vars}){Page(page:$page,perPage:${PAGE_SIZE}){pageInfo{hasNextPage} activities(${args},sort:ID_DESC){${ACT}}}}`;
  const Q = {
    viewer: 'query{Viewer{id}}',
    user: 'query($name:String){User(name:$name){id name}}',
    state: 'query($id:Int){Activity(id:$id){... on TextActivity{isLiked} ... on ListActivity{isLiked} ... on MessageActivity{isLiked}}}',
    profile: pageQuery(',$uid:Int', 'userId:$uid'),
    following: pageQuery('', 'isFollowing:true'),
    global: pageQuery('', 'isFollowing:false,hasRepliesOrTypeText:true'),
    like: 'mutation($id:Int){ToggleLike(id:$id,type:ACTIVITY){id}}',
  };

  const DEFAULTS = {
    minDelay: 1500, // ms
    maxDelay: 4000, // ms
    maxLikes: 0, // 0 = unlimited
    autoScroll: true, // keep going through older posts
    blacklist: [],
    lang: 'auto',
    preset: 'careful',
    reqPerMin: 25, // AniList is at 30/min right now (normally 90)
    homeFeed: 'following',
  };

  let lang = 'auto';
  const tr = (key, vars) => t(lang, key, vars);

  let running = false;
  let stopFlag = false;
  let likedCount = 0;
  let waitUntil = 0; // set while paused by the rate limit
  let capPerMin = DEFAULTS.reqPerMin;
  let fallbackCap = DEFAULTS.reqPerMin;
  const reqTimes = [];

  // sleep, but bail out when Stop is pressed
  const sleep = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end && !stopFlag) {
      await new Promise((r) => setTimeout(r, Math.min(100, end - Date.now())));
    }
  };
  // sleep for the rate limit, and tell the user why nothing is happening
  async function pause(ms) {
    waitUntil = Date.now() + ms;
    if (ms >= 5000) toast(tr('waiting', { s: Math.ceil(ms / 1000) }));
    updateButton();
    const tick = setInterval(updateButton, 1000);
    try {
      await sleep(ms);
    } finally {
      clearInterval(tick);
      waitUntil = 0;
      updateButton();
    }
  }
  const waitLeft = () => (waitUntil > Date.now() ? Math.ceil((waitUntil - Date.now()) / 1000) : 0);
  const rand = (a, b) => a + Math.random() * (b - a);
  const log = (...a) => console.log('[AniList Auto-Like]', ...a);

  async function getSettings() {
    const s = await api.storage.local.get(DEFAULTS);
    return { ...DEFAULTS, ...s };
  }

  function getTarget() {
    const m = location.pathname.match(/^\/user\/([^/]+)/);
    if (m) return { kind: 'user', name: decodeURIComponent(m[1]) };
    if (/^\/home(\/|$)/.test(location.pathname)) return { kind: 'home' };
    return null;
  }

  const fail = (code, message) => Object.assign(new Error(message), { code });

  async function throttle() {
    for (;;) {
      const now = Date.now();
      while (reqTimes.length && now - reqTimes[0] > 60000) reqTimes.shift();
      if (reqTimes.length < capPerMin) break;
      await pause(reqTimes[0] + 60000 - now + 50);
      if (stopFlag) return;
    }
    reqTimes.push(Date.now());
  }

  async function gql(query, variables, token) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await throttle();
      if (stopFlag) throw fail('stopped', 'stopped');
      let res;
      try {
        res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query, variables }),
        });
      } catch (netErr) {
        // 429s come back without CORS headers, so the browser reports them as NetworkError.
        // Treat it as a rate limit: normal cap, wait a minute, retry.
        capPerMin = Math.min(capPerMin, fallbackCap);
        if (attempt === 2) throw fail('api', `${netErr.message} (rate limit or no connection)`);
        await pause(61000);
        if (stopFlag) throw fail('stopped', 'stopped');
        continue;
      }
      if (res.status === 429) {
        // back to the normal cap, this is how Turbo finds the real limit
        capPerMin = Math.min(capPerMin, fallbackCap);
        const wait = ((parseInt(res.headers.get('Retry-After'), 10) || 60) + 0.5) * 1000;
        await pause(wait);
        if (stopFlag) throw fail('stopped', 'stopped');
        continue;
      }
      const json = await res.json().catch(() => null);
      const errs = (json && json.errors) || [];
      if (res.status === 401 || errs.some((e) => e.status === 401)) throw fail('auth', 'unauthorized');
      if (!res.ok || errs.length) throw fail('api', (errs[0] && errs[0].message) || `HTTP ${res.status}`);
      if (!json) throw fail('api', 'empty response');
      return json.data;
    }
    throw fail('api', 'rate limited (429)');
  }

  // checks the saved token; `error` is only set for real failures (network, API down)
  async function connect(probes) {
    const st = await api.storage.local.get({ anilistToken: '', tokenExp: 0 });
    if (!st.anilistToken) {
      probes.push('stored token: none (not connected)');
      return { token: null };
    }
    if (st.tokenExp && st.tokenExp < Date.now()) {
      probes.push('stored token: expired');
      return { token: null };
    }
    try {
      const d = await gql(Q.viewer, {}, st.anilistToken);
      if (d && d.Viewer && d.Viewer.id) return { token: st.anilistToken };
      probes.push('stored token: logged-in user NOT found');
      return { token: null };
    } catch (e) {
      if (e.code === 'stopped') return { token: null };
      probes.push(`stored token: ${e.code || 'error'} - ${String(e.message).slice(0, 160)}`);
      return { token: null, error: e.code === 'auth' ? null : e };
    }
  }

  // paint the hearts red on screen
  function markLiked(id) {
    try {
      const re = new RegExp(`/activity/${id}(?:$|[/?#])`);
      document.querySelectorAll('a[href*="/activity/"]').forEach((a) => {
        if (!re.test(a.getAttribute('href'))) return;
        const entry = a.closest(SEL.entry);
        const btn = entry && entry.querySelector(SEL.likeBtn);
        if (btn) btn.classList.add('liked');
      });
    } catch (_) {
      /* cosmetic only */
    }
  }

  function toast(msg) {
    let el = document.getElementById('alk-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'alk-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('alk-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('alk-show'), 7000);
  }

  function showDebug(text) {
    document.getElementById('alk-debug')?.remove();
    const box = document.createElement('div');
    box.id = 'alk-debug';
    const title = document.createElement('strong');
    title.textContent = 'Auto-Like debug info';
    const ta = document.createElement('textarea');
    ta.readOnly = true;
    ta.value = text;
    const row = document.createElement('div');
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        ta.select();
        document.execCommand('copy');
      }
      copy.textContent = 'Copied ✓';
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => box.remove());
    row.append(copy, close);
    box.append(title, ta, row);
    document.body.appendChild(box);
  }

  function updateButton() {
    const b = document.getElementById('alk-btn');
    if (!b) return;
    b.classList.toggle('alk-running', running);
    const left = waitLeft();
    b.querySelector('span').textContent = running ? `${tr('stop')} (${likedCount})${left > 2 ? ` · ${left}s` : ''}` : tr('like');
  }

  function injectButton() {
    if (!isCurrent()) {
      observer.disconnect();
      return;
    }
    if (document.getElementById('alk-btn')) return;
    const b = document.createElement('button');
    b.id = 'alk-btn';
    b.type = 'button';
    b.title = 'AniList Auto-Like';
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 21S3 15.2 3 8.9C3 6 5.2 4 7.8 4c1.8 0 3.3.9 4.2 2.4C12.9 4.9 14.4 4 16.2 4 18.8 4 21 6 21 8.9 21 15.2 12 21 12 21z"/></svg><span></span>';
    b.addEventListener('click', () => (running ? stop() : run()));
    const host = document.querySelector(SEL.nav);
    if (host) {
      host.appendChild(b);
    } else {
      b.classList.add('alk-floating');
      document.body.appendChild(b);
    }
    updateButton();
  }

  function stop() {
    stopFlag = true;
  }

  async function run() {
    if (running) return;
    const target = getTarget();
    if (!target) {
      toast(tr('invalidPage'));
      return;
    }
    running = true;
    stopFlag = false;
    likedCount = 0;
    updateButton();

    let reasonKey = 'rStopped';
    let reasonVars = {};
    const stats = { posts: 0, already: 0, bl: 0, pages: 0 };
    const probes = [];
    let apiError = null;
    let token = null;
    const abort = (key, vars = {}) => {
      reasonKey = key;
      reasonVars = vars;
      stopFlag = true;
    };

    try {
      const s = await getSettings();
      lang = s.lang;
      updateButton();
      const blacklist = new Set(s.blacklist.map((u) => u.toLowerCase()));
      const minD = Math.min(s.minDelay, s.maxDelay);
      const maxD = Math.max(s.minDelay, s.maxDelay);
      fallbackCap = Math.max(1, Number(s.reqPerMin) || DEFAULTS.reqPerMin);
      capPerMin = s.preset === 'turbo' ? Math.max(TURBO_CAP, fallbackCap) : fallbackCap;
      reqTimes.length = 0;

      const conn = await connect(probes);
      token = conn.token;
      if (!token && !stopFlag) {
        if (conn.error) {
          apiError = String(conn.error.message || conn.error);
          abort('rApi', { msg: apiError });
        } else {
          abort('rAuth');
        }
      }

      let query = null;
      let vars = {};
      if (token && !stopFlag) {
        if (target.kind === 'user') {
          const d = await gql(Q.user, { name: target.name }, token);
          if (d && d.User) {
            query = Q.profile;
            vars = { uid: d.User.id };
          } else {
            apiError = `user "${target.name}" not found`;
            abort('rApi', { msg: apiError });
          }
        } else {
          query = s.homeFeed === 'global' ? Q.global : Q.following;
        }
      }

      let pageNo = 1;
      let caught = 0;
      let verified = false;

      while (query && !stopFlag) {
        const d = await gql(query, { page: pageNo, ...vars }, token);
        const P = d && d.Page;
        const list = ((P && P.activities) || []).filter((a) => a && typeof a.id === 'number');
        stats.pages++;
        let needed = 0;

        for (const a of list) {
          if (stopFlag) break;
          stats.posts++;
          if (a.isLiked) {
            stats.already++;
            continue;
          }
          const owner = ((a.user && a.user.name) || (a.messenger && a.messenger.name) || '').toLowerCase();
          if (owner && blacklist.has(owner)) {
            stats.bl++;
            continue;
          }
          needed++;

          await gql(Q.like, { id: a.id }, token);
          if (!verified) {
            // make sure the first like really went through
            const v = await gql(Q.state, { id: a.id }, token);
            if (!(v && v.Activity && v.Activity.isLiked)) {
              apiError = 'ToggleLike returned OK but the activity is still not liked';
              abort('rApi', { msg: apiError });
              break;
            }
            verified = true;
          }
          likedCount++;
          markLiked(a.id);
          updateButton();

          if (s.maxLikes > 0 && likedCount >= s.maxLikes) {
            abort('rLimit');
            break;
          }
          await sleep(rand(minD, maxD));
        }

        if (stopFlag) break;
        caught = needed === 0 ? caught + 1 : 0;
        if (caught >= CAUGHT_UP_PAGES) {
          reasonKey = 'rCaughtUp';
          break;
        }
        if (!s.autoScroll) {
          reasonKey = 'rDone';
          break;
        }
        if (!(P && P.pageInfo && P.pageInfo.hasNextPage)) {
          reasonKey = 'rNoMore';
          break;
        }
        pageNo++;
      }

      log('stats', stats, 'liked', likedCount);
      let msg = `${tr('result', { n: likedCount })} ${tr(reasonKey, reasonVars)}`;
      if (likedCount === 0 && stats.posts > 0 && reasonKey !== 'rAuth' && reasonKey !== 'rApi') {
        msg += ` ${tr('stats', stats)}`;
      }
      toast(msg);

      if (reasonKey === 'rAuth' || reasonKey === 'rApi' || (stats.posts === 0 && reasonKey !== 'rStopped')) {
        const report = [
          `AniList Auto-Like v${api.runtime.getManifest().version} debug`,
          `page: ${location.pathname} (${target.kind})`,
          `ua: ${navigator.userAgent}`,
          `result: ${reasonKey} | stats: ${JSON.stringify(stats)}`,
          `connected: ${token ? 'yes' : 'no'} | preset: ${s.preset} | cap: ${capPerMin}/min`,
          `api error: ${apiError || 'none'}`,
          probes.length ? `probes:\n${probes.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        log(report);
        showDebug(report);
      }
    } catch (e) {
      if (e && e.code === 'stopped') {
        toast(`${tr('result', { n: likedCount })} ${tr('rStopped')}`);
      } else if (e && e.code === 'auth') {
        toast(tr('rAuth'));
      } else {
        log('error', e);
        const invalidated = /context invalidated|Extension context/i.test(String(e && e.message));
        toast(invalidated ? tr('reload') : tr('rApi', { msg: (e && e.message) || e }));
      }
    } finally {
      running = false;
      stopFlag = false;
      updateButton();
    }
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isCurrent()) return;
    if (msg.type === 'start') run();
    else if (msg.type === 'stop') stop();
    sendResponse({ running, likedCount, waiting: waitLeft() });
  });

  api.storage.onChanged.addListener((changes) => {
    if (changes.lang) {
      lang = changes.lang.newValue || 'auto';
      updateButton();
    }
  });

  // AniList is an SPA, put the button back if navigation drops it
  document.getElementById('alk-btn')?.remove(); // stale button from an older copy
  const observer = new MutationObserver(injectButton);
  injectButton();
  observer.observe(document.body, { childList: true, subtree: true });

  api.storage.local
    .get({ lang: 'auto' })
    .then((s) => {
      lang = s.lang;
      updateButton();
    })
    .catch(() => {});
})();
