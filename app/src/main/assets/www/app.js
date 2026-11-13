/* Family TV - UI logic. Plain ES2017 so it runs on the Fire OS 7 WebView. */
(function () {
  'use strict';
  var C = window.FTV_CONFIG;
  var A = window.Android || mockBridge();
  var IMG = 'https://image.tmdb.org/t/p/';
  var stage = document.getElementById('stage');
  var S = { screen: 'picker', tab: 'home', installed: [], byPkg: {}, icons: {}, pinMode: 'enter', pinBuf: '', pinFirst: '', after: null, overlay: null, lastFocus: {}, heroTimer: 0 };
  var cbs = {}, cbId = 0;

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = Math.abs(s - 1) < 0.001 ? '' : 'scale(' + s + ')';
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function year(it) { return String(it.release_date || it.first_air_date || '').slice(0, 4); }
  function title(it) { return it.title || it.name || ''; }

  // ---------------------------------------------------------------- clock
  function tick() {
    var now = new Date();
    var t = now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    var d = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    Array.prototype.forEach.call(document.querySelectorAll('[data-clock]'), function (el) {
      el.textContent = el.getAttribute('data-clock') === 'date' ? d : t;
    });
    var h = now.getHours();
    $('kids-greet').textContent = h < 12 ? 'Good morning, superstar!' : h < 17 ? 'Good afternoon, superstar!' : 'Good evening, superstar!';
  }

  // ---------------------------------------------------------------- installed apps
  function loadApps() {
    try { S.installed = JSON.parse(A.getApps()) || []; } catch (e) { S.installed = []; }
    S.byPkg = {};
    S.installed.forEach(function (a) { S.byPkg[a.pkg] = a; });
  }
  function resolve(id) {
    var def = C.apps[id];
    if (!def) return null;
    for (var i = 0; i < def.pkgs.length; i++) if (S.byPkg[def.pkgs[i]]) return def.pkgs[i];
    if (def.match) for (var j = 0; j < S.installed.length; j++) if (def.match.test(S.installed[j].label)) return S.installed[j].pkg;
    return null;
  }
  function icon(pkg) {
    if (!pkg) return null;
    if (S.icons[pkg] === undefined) {
      try { S.icons[pkg] = JSON.parse(A.getIcon(pkg) || 'null'); } catch (e) { S.icons[pkg] = null; }
    }
    return S.icons[pkg];
  }
  // Opens the featured show itself when the app accepts links, otherwise just the app.
  function openFeatured() {
    var f = C.kidsFeatured, pkg = resolve(f.app);
    if (!pkg) { toast(f.cta.replace('Watch on ', '') + ' isn\u2019t installed yet. Ask a grown-up.'); return; }
    if (f.url && A.openUrl(f.url, pkg)) return;
    A.launch(pkg);
  }
  function openApp(id, label) {
    var pkg = resolve(id);
    if (!pkg) { toast((label || (C.apps[id] && C.apps[id].name) || 'That app') + ' isn’t installed yet. Ask a grown-up.'); return; }
    if (!A.launch(pkg)) toast('Couldn’t open ' + (label || pkg));
  }

  // ---------------------------------------------------------------- TMDB
  window.app = window.app || {};
  app.tmdbDone = function (id, code, body) {
    var cb = cbs[id]; delete cbs[id];
    if (!cb) return;
    var data = null;
    try { data = code >= 200 && code < 300 ? JSON.parse(body) : null; } catch (e) { data = null; }
    cb(data, code);
  };
  function tmdb(path) {
    var key = 'tmdb:' + path;
    try {
      var hit = JSON.parse(localStorage.getItem(key) || 'null');
      if (hit && Date.now() - hit.t < C.cacheHours * 3600e3) return Promise.resolve(hit.d);
    } catch (e) { }
    return new Promise(function (res) {
      var id = 'c' + (++cbId);
      cbs[id] = function (data) {
        if (data) { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { } }
        res(data);
      };
      A.tmdb(path, id);
    });
  }
  function q(kind, provider, extra) {
    return 'discover/' + kind + '?watch_region=' + C.region + '&with_watch_providers=' + provider +
      '&with_watch_monetization_types=flatrate&include_adult=false&language=en-AU' + (extra || '');
  }
  function list(kind, service, extra, n) {
    return tmdb(q(kind, C.providers[service], extra)).then(function (d) {
      return ((d && d.results) || []).filter(function (it) { return it.backdrop_path || it.poster_path; })
        .slice(0, n || 20).map(function (it) { it._kind = kind; it._service = service; return it; });
    });
  }
  function mix(a, b, n) {
    var out = [], i = 0;
    while (out.length < (n || 20) && (i < a.length || i < b.length)) {
      if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); i++;
    }
    return out.slice(0, n || 20);
  }
  var POP = '&sort_by=popularity.desc';
  var NEWM = function () { return '&sort_by=primary_release_date.desc&primary_release_date.lte=' + today() + '&vote_count.gte=15'; };
  var NEWT = function () { return '&sort_by=first_air_date.desc&first_air_date.lte=' + today() + '&vote_count.gte=8'; };
  var TOPM = '&sort_by=vote_average.desc&vote_count.gte=1500';
  var TOPT = '&sort_by=vote_average.desc&vote_count.gte=600';
  var KIDM = '&with_genres=10751&certification_country=AU&certification.lte=PG' + POP;
  var KIDT = '&with_genres=10762' + POP;

  // ---------------------------------------------------------------- screens
  function show(name) {
    ['picker', 'pin', 'kids', 'parents'].forEach(function (n) { $(n).classList.toggle('active', n === name); });
    document.body.classList.toggle('kidsmode', name === 'kids');
    S.screen = name;
    closeOverlay(true);
    setTimeout(function () { focusFirst(); }, 30);
  }
  function openOverlay(name) { S.overlay = name; $(name).classList.add('active'); setTimeout(focusFirst, 30); }
  function closeOverlay(silent) {
    if (!S.overlay) return;
    $(S.overlay).classList.remove('active'); S.overlay = null;
    if (!silent && S.returnFocus && document.body.contains(S.returnFocus)) focusEl(S.returnFocus);
  }
  function root() { return S.overlay ? $(S.overlay) : $(S.screen); }

  // ---------------------------------------------------------------- picker + PIN
  function chooseKids() { renderKids(); show('kids'); }
  function askPin(after) {
    S.after = after; S.pinBuf = '';
    S.pinMode = A.hasPin() ? 'enter' : 'create1';
    renderPin(); show('pin');
  }
  function renderPin() {
    var t = { enter: 'Enter parents PIN', create1: 'Create a parents PIN', create2: 'Enter the PIN again' }[S.pinMode];
    $('pin-title').textContent = t;
    $('pin-sub').textContent = S.pinMode === 'enter' ? '4 digits' : 'Choose 4 digits only grown-ups know';
    var dots = $('pin').querySelectorAll('.pin-dots i');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < S.pinBuf.length);
    if (!$('pin-pad').children.length) {
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'del'];
      $('pin-pad').innerHTML = keys.map(function (k) {
        var label = k === 'back' ? 'Cancel' : k === 'del' ? 'Delete' : k;
        return '<button class="pin-key' + (k.length > 1 ? ' small' : '') + '" data-nav data-pin="' + k + '">' + label + '</button>';
      }).join('');
    }
  }
  function pinKey(k) {
    $('pin-msg').textContent = '';
    if (k === 'back') { show('picker'); return; }
    if (k === 'del') { S.pinBuf = S.pinBuf.slice(0, -1); renderPin(); return; }
    if (S.pinBuf.length >= 4) return;
    S.pinBuf += k; renderPin();
    if (S.pinBuf.length < 4) return;
    var pin = S.pinBuf;
    setTimeout(function () {
      S.pinBuf = '';
      if (S.pinMode === 'create1') { S.pinFirst = pin; S.pinMode = 'create2'; renderPin(); return; }
      if (S.pinMode === 'create2') {
        if (pin !== S.pinFirst) { S.pinMode = 'create1'; renderPin(); $('pin-msg').textContent = 'Those didn’t match. Try again.'; return; }
        A.setPin(pin); toast('PIN saved'); var f = S.after; S.after = null; f(); return;
      }
      var r = A.checkPin(pin);
      if (r === 'ok') { var g = S.after; S.after = null; g(); return; }
      renderPin();
      $('pin-msg').textContent = r.indexOf('locked') === 0 ? 'Too many tries. Wait ' + r.split(':')[1] + ' seconds.' : 'Wrong PIN. Try again.';
    }, 180);
  }

  // ---------------------------------------------------------------- kids
  function kidsIcon(kind) {
    if (kind === 'star') return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFC93C" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>';
    return '<svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l12 7-12 7z" fill="#FFFFFF"/></svg>';
  }
  function iconImg(pkg) {
    var ic = icon(pkg);
    return ic && ic.src ? '<img src="' + ic.src + '" alt="">' : '';
  }
  function renderKids() {
    var f = C.kidsFeatured;
    var side = C.kidsSide.map(function (s) {
      var miss = resolve(s.app) ? '' : ' missing';
      return '<button class="kside-tile kfocus' + miss + '" data-nav data-app="' + s.app + '" data-label="' + esc(s.title) + '">' +
        '<span class="kside-ico" style="background:' + s.bg + '">' + kidsIcon(s.icon) + '</span>' +
        '<span><span class="kside-title" style="display:block">' + esc(s.title) + '</span><span class="kside-note">' + esc(s.note) + '</span></span></button>';
    }).join('');
    $('kids-hero').innerHTML =
      '<button class="kfeat kfocus' + (resolve(f.app) ? '' : ' missing') + '" id="kfeat" data-nav data-action="featured" aria-label="' + esc(f.title + ', ' + f.cta) + '">' +
      '<span class="kfeat-bg" id="kfeat-bg"></span><span class="kfeat-shade" aria-hidden="true"></span>' +
      '<span class="boxes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      '<span class="kbadge">' + esc(f.badge) + '</span><span class="kfeat-title">' + esc(f.title) + '</span>' +
      '<span class="kfeat-cta"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1F2240"/><path d="M10 8l6 4-6 4z" fill="#FFFFFF"/></svg>' + esc(f.cta) + '</span></button>' +
      '<div class="kside">' + side + '</div>';
    $('kids-apps').innerHTML = C.kidsApps.map(function (a) {
      var pkg = resolve(a.app);
      return '<button class="ktile kfocus' + (pkg ? '' : ' missing') + '" data-nav data-app="' + a.app + '" data-label="' + esc(a.name) + '" style="background:' + a.bg + ';color:' + a.fg + '">' +
        '<span class="kicon">' + iconImg(pkg) + '</span><span><span class="ktile-name" style="display:block">' + esc(a.name) + '</span><span class="ktile-note">' + esc(pkg ? a.note : 'Not installed') + '</span></span></button>';
    }).join('');
    $('kids-games').innerHTML = C.kidsGames.map(function (a) {
      var pkg = resolve(a.app);
      return '<button class="ktile kgame kfocus' + (pkg ? '' : ' missing') + '" data-nav data-app="' + a.app + '" data-label="' + esc(a.name) + '" style="background:' + a.bg + ';color:' + a.fg + '">' +
        '<span class="kicon">' + iconImg(pkg) + '</span><span class="ktile-name">' + esc(a.name) + '</span></button>';
    }).join('');
    if (f.tmdbTv && A.hasTmdbKey()) {
      tmdb('tv/' + f.tmdbTv + '?language=en-AU').then(function (d) {
        var path = d && (d.backdrop_path || d.poster_path);
        if (!path) return;
        var bg = $('kfeat-bg'); if (!bg) return;
        var im = new Image();
        im.onload = function () { bg.style.backgroundImage = 'url(' + im.src + ')'; bg.classList.add('on'); $('kfeat').classList.add('has-art'); };
        im.src = IMG + 'w1280' + path;
      });
    }
    fillKidsRow('kids-movies', 'movie', KIDM);
    fillKidsRow('kids-series', 'tv', KIDT);
  }
  function fillKidsRow(id, kind, extra) {
    var el = $(id);
    if (!A.hasTmdbKey()) { el.innerHTML = '<div class="kinfo">Ask a grown-up to add the movie key to see movies here.</div>'; return; }
    el.innerHTML = skeletons(6, 'kmovie skeleton');
    Promise.all([list(kind, 'netflix', extra, 12), list(kind, 'prime', extra, 12)]).then(function (r) {
      var items = mix(r[0], r[1], 16);
      if (!items.length) { el.innerHTML = '<div class="kinfo">No movies right now. Try again later.</div>'; return; }
      el.innerHTML = items.map(function (it) {
        var img = it.backdrop_path || it.poster_path;
        return '<button class="kmovie kfocus" data-nav data-item=\'' + store(it) + '\'>' +
          '<img src="' + IMG + 'w500' + img + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"><span class="kmovie-title">' + esc(title(it)) + '</span>' +
          '<span class="kmovie-where">' + (it._service === 'netflix' ? 'Netflix' : 'Prime Video') + '</span></button>';
      }).join('');
    });
  }
  var items = {}, itemId = 0;
  function store(it) { var k = 'i' + (++itemId); items[k] = it; return k; }
  function skeletons(n, cls) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="' + cls + '"></div>'; return s; }

  // ---------------------------------------------------------------- parents
  function renderParents() {
    Array.prototype.forEach.call(document.querySelectorAll('.ptab'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    var body = $('pbody');
    body.scrollTop = 0;
    var noKey = !A.hasTmdbKey();
    var keyInfo = '<div class="pinfo">Movie and series rows need your free TMDB key. On the PC run <b>firetv.ps1 homeapp-key</b> and it’s sent to the TV.</div>';
    var foot = '<p class="pfoot">This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data by JustWatch, via TMDB. Popularity is TMDB’s, not Netflix’s or Prime’s own charts.</p>';
    var html = '';
    if (S.tab === 'home') {
      html = '<div class="phero" id="phero"><div class="phero-img skeleton" id="phero-img"></div><div class="phero-scrim"></div><div class="phero-body" id="phero-body"></div></div>' +
        (noKey ? keyInfo : '') +
        sec('top', 'Popular this week', 'Netflix and Prime Video · Australia') +
        sec('newm', 'New movies', 'Recently released on Netflix and Prime') +
        sec('newt', 'New series', 'Recently started') +
        appsSec('Live TV', C.liveTv) + appsSec('Your apps', C.parentsApps) + foot;
    } else if (S.tab === 'movies') {
      html = (noKey ? keyInfo : '') + sec('nfm', 'Popular on Netflix', 'Movies') + sec('pvm', 'Popular on Prime Video', 'Movies') +
        sec('newm', 'New movies', 'Recently released') + sec('topm', 'Top rated', 'Highest rated on Netflix and Prime') + foot;
    } else if (S.tab === 'series') {
      html = (noKey ? keyInfo : '') + sec('nft', 'Popular on Netflix', 'Series') + sec('pvt', 'Popular on Prime Video', 'Series') +
        sec('newt', 'New series', 'Recently started') + sec('topt', 'Top rated', 'Highest rated series') + foot;
    } else if (S.tab === 'live') {
      html = appsGrid('Live TV and catch-up', C.liveTv.map(resolve).filter(Boolean));
    } else {
      var all = S.installed.slice().sort(function (a, b) { return a.label.localeCompare(b.label); }).map(function (a) { return a.pkg; });
      html = appsGrid('All apps', all);
    }
    body.innerHTML = '<div style="padding-top:10px">' + html + '</div>';
    if (noKey && (S.tab === 'home' || S.tab === 'movies' || S.tab === 'series')) {
      Array.prototype.forEach.call(body.querySelectorAll('.prow[data-row]'), function (r) { r.parentNode.style.display = 'none'; });
      if ($('phero')) $('phero').style.display = 'none';
      return;
    }
    if (S.tab === 'home') {
      Promise.all([list('movie', 'netflix', POP, 5), list('movie', 'prime', POP, 5)]).then(function (r) {
        var top = mix(r[0], r[1], 10);
        top.forEach(function (it, i) { it._rank = i + 1; });
        fillRow('top', top, true);
        if (top[0]) setHero(top[0], true);
      });
      Promise.all([list('movie', 'netflix', NEWM(), 10), list('movie', 'prime', NEWM(), 10)]).then(function (r) { fillRow('newm', mix(r[0], r[1], 16), false, true); });
      Promise.all([list('tv', 'netflix', NEWT(), 10), list('tv', 'prime', NEWT(), 10)]).then(function (r) { fillRow('newt', mix(r[0], r[1], 16), false, true); });
    } else if (S.tab === 'movies') {
      list('movie', 'netflix', POP).then(function (r) { fillRow('nfm', r); });
      list('movie', 'prime', POP).then(function (r) { fillRow('pvm', r); });
      Promise.all([list('movie', 'netflix', NEWM(), 10), list('movie', 'prime', NEWM(), 10)]).then(function (r) { fillRow('newm', mix(r[0], r[1], 16), false, true); });
      Promise.all([list('movie', 'netflix', TOPM, 10), list('movie', 'prime', TOPM, 10)]).then(function (r) { fillRow('topm', mix(r[0], r[1], 16)); });
    } else if (S.tab === 'series') {
      list('tv', 'netflix', POP).then(function (r) { fillRow('nft', r); });
      list('tv', 'prime', POP).then(function (r) { fillRow('pvt', r); });
      Promise.all([list('tv', 'netflix', NEWT(), 10), list('tv', 'prime', NEWT(), 10)]).then(function (r) { fillRow('newt', mix(r[0], r[1], 16), false, true); });
      Promise.all([list('tv', 'netflix', TOPT, 10), list('tv', 'prime', TOPT, 10)]).then(function (r) { fillRow('topt', mix(r[0], r[1], 16)); });
    }
  }
  function sec(id, h, sub) {
    return '<section class="psec"><div class="psec-head"><h2>' + esc(h) + '</h2><span>' + esc(sub) + '</span></div>' +
      '<div class="prow row-scroll" data-row="' + id + '" id="row-' + id + '">' + skeletons(6, 'pcard skeleton') + '</div></section>';
  }
  function fillRow(id, arr, ranked, isNew) {
    var el = $('row-' + id);
    if (!el) return;
    if (!arr.length) { el.innerHTML = '<div class="pinfo">Nothing to show right now.</div>'; return; }
    el.innerHTML = arr.map(function (it) {
      var img = it.backdrop_path || it.poster_path;
      var prime = it._service === 'prime';
      return '<button class="pcard" data-nav data-item="' + store(it) + '">' +
        '<img src="' + IMG + 'w500' + img + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
        (ranked ? '<span class="pcard-rank" aria-hidden="true">' + it._rank + '</span>' : '') +
        (isNew ? '<span class="pcard-badge new">NEW</span>' : '') +
        '<span class="pcard-badge' + (prime ? ' prime' : '') + '">' + (prime ? 'Prime' : 'Netflix') + '</span>' +
        '<span class="pcard-title">' + esc(title(it)) + '</span></button>';
    }).join('');
  }
  function appTile(pkg) {
    var a = S.byPkg[pkg]; if (!a) return '';
    var ic = icon(pkg);
    var img = ic && ic.src ? '<img class="' + (ic.banner ? 'banner' : 'icon') + '" src="' + ic.src + '" alt="">' : '';
    return '<button class="papp' + (ic && ic.banner ? ' has-banner' : '') + '" data-nav data-pkg="' + esc(pkg) + '" aria-label="' + esc(a.label) + '">' + img +
      '<span class="papp-name">' + esc(a.label) + '</span></button>';
  }
  function appsSec(h, ids) {
    var tiles = ids.map(resolve).filter(Boolean).map(appTile).join('');
    return tiles ? '<section class="psec"><div class="psec-head"><h2>' + esc(h) + '</h2></div><div class="pgrid">' + tiles + '</div></section>' : '';
  }
  function appsGrid(h, pkgs) {
    return '<section class="psec"><div class="psec-head"><h2>' + esc(h) + '</h2><span>' + pkgs.length + ' apps</span></div><div class="pgrid">' + pkgs.map(appTile).join('') + '</div></section>' +
      '<section class="psec"><button class="pbtn" data-nav data-action="fire-settings">Open Fire TV settings</button></section>';
  }
  function setHero(it, first) {
    var body = $('phero-body'), img = $('phero-img');
    if (!body || !img) return;
    img.classList.remove('skeleton');
    img.style.backgroundImage = it.backdrop_path ? 'url(' + IMG + 'w1280' + it.backdrop_path + ')' : '';
    var svc = it._service === 'prime' ? 'Prime Video' : 'Netflix';
    var meta = [year(it), it.vote_average ? '★ ' + it.vote_average.toFixed(1) : '', it._kind === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' · ');
    var k = store(it);
    body.innerHTML = '<span class="phero-kicker">' + (it._rank ? '<b>#' + it._rank + '</b>' : '') + 'Popular on ' + svc + ' in Australia</span>' +
      '<span class="phero-title">' + esc(title(it)) + '</span><span class="phero-meta">' + esc(meta) + '</span>' +
      '<span class="phero-ov">' + esc(it.overview) + '</span>' +
      '<div class="pbtns"><button class="pbtn primary" data-nav data-open="' + k + '"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="#0E1116"/></svg>Open in ' + svc + '</button>' +
      '<button class="pbtn" data-nav data-item="' + k + '">More info</button></div>';
    if (first && S.screen === 'parents' && !S.overlay) setTimeout(function () { if (!document.activeElement || document.activeElement === document.body) focusFirst(); }, 50);
  }

  // ---------------------------------------------------------------- detail + settings
  function openDetail(it) {
    S.returnFocus = document.activeElement;
    var svc = it._service === 'prime' ? 'Prime Video' : 'Netflix';
    $('detail-bg').style.backgroundImage = it.backdrop_path ? 'url(' + IMG + 'w1280' + it.backdrop_path + ')' : '';
    $('detail-kicker').textContent = (it._kind === 'tv' ? 'Series' : 'Movie') + ' on ' + svc;
    $('detail-title').textContent = title(it);
    $('detail-meta').textContent = [year(it), it.vote_average ? '★ ' + it.vote_average.toFixed(1) + ' / 10' : ''].filter(Boolean).join(' · ');
    $('detail-overview').textContent = it.overview || '';
    $('detail-actions').innerHTML = '<button class="pbtn primary" data-nav data-open="' + store(it) + '">Open ' + svc + '</button><button class="pbtn" data-nav data-action="close">Back</button>';
    openOverlay('detail');
  }
  function openService(it) { openApp(it._service === 'prime' ? 'prime' : 'netflix'); }
  function openSettings() {
    S.returnFocus = document.activeElement;
    var items = [
      ['pin', 'Change parents PIN', ''],
      ['refresh', 'Refresh movies and series', ''],
      ['fire-settings', 'Fire TV settings', ''],
      ['close', 'Close', '']
    ];
    $('set-list').innerHTML = items.map(function (i) { return '<button class="set-item" data-nav data-action="' + i[0] + '"><span>' + i[1] + '</span><span>' + i[2] + '</span></button>'; }).join('');
    $('set-about').innerHTML = 'Family TV ' + esc(A.getVersion()) + ' · TMDB key: ' + (A.hasTmdbKey() ? 'added' : 'missing (run firetv.ps1 homeapp-key on the PC)') +
      '<br>This product uses the TMDB API but is not endorsed or certified by TMDB.';
    openOverlay('settings');
  }

  // ---------------------------------------------------------------- remote control
  function focusables() {
    var r = root();
    return Array.prototype.filter.call(r.querySelectorAll('[data-nav]'), function (el) {
      return el.offsetParent !== null || el.getClientRects().length;
    });
  }
  function rect(el) {
    var b = el.getBoundingClientRect();
    return { l: b.left, r: b.right, t: b.top, b: b.bottom, cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2 };
  }
  function rowOf(el) { return el.closest('[data-row], .kgrid, .krow, .pgrid, .pbtns, .ptabs, .kids-hero, .picker-cards, .pin-pad, .set-list, .detail-actions'); }
  function focusFirst() {
    var list = focusables();
    var r = root();
    var prefer = r.querySelector('.pbtn.primary[data-nav], .kfeat[data-nav], .pick-kids, .pin-key, .set-item') || list[0];
    if (S.screen === 'parents' && !S.overlay) prefer = r.querySelector('.pbtns .pbtn.primary') || r.querySelector('.pcard[data-nav], .papp[data-nav]') || r.querySelector('.ptab.on');
    if (prefer) focusEl(prefer);
  }
  function focusEl(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    var row = rowOf(el);
    if (row) S.lastFocus[rowKey(row)] = el;
    var hs = el.closest('.row-scroll');
    if (hs) {
      var target = Math.max(0, el.offsetLeft - 80);
      if (el.offsetLeft - hs.scrollLeft < 40 || el.offsetLeft + el.offsetWidth - hs.scrollLeft > hs.clientWidth - 40) hs.scrollTo({ left: target, behavior: 'smooth' });
    }
    var vs = el.closest('.page-scroll');
    if (vs) {
      var sec = el.closest('.psec, .ksec, .phero, .kids-hero, .kids-top') || el;
      var vr = vs.getBoundingClientRect();
      var scale = (vr.height / vs.clientHeight) || 1;
      var top = (sec.getBoundingClientRect().top - vr.top) / scale + vs.scrollTop;
      var atTop = sec.classList.contains('phero') || sec.classList.contains('kids-top') || sec.classList.contains('kids-hero');
      var want = atTop ? 0 : top - (S.screen === 'parents' ? 140 : 60);
      vs.scrollTo({ top: Math.max(0, want), behavior: 'smooth' });
    }
    var k = el.getAttribute('data-item');
    if (k && S.screen === 'parents' && S.tab === 'home' && !S.overlay && items[k]) {
      clearTimeout(S.heroTimer);
      S.heroTimer = setTimeout(function () { setHero(items[k]); }, 350);
    }
  }
  function rowKey(row) { return row.id || row.getAttribute('data-row') || row.className; }
  function move(dir) {
    var cur = document.activeElement, list = focusables();
    if (!list.length) return;
    if (list.indexOf(cur) < 0) { focusFirst(); return; }
    var r = rect(cur), best = null, bestScore = Infinity, curRow = rowOf(cur);
    list.forEach(function (el) {
      if (el === cur) return;
      var e = rect(el), main, cross;
      if (dir === 'left') { if (e.cx >= r.cx - 4 || e.r > r.l + 8) return; main = r.l - e.r; cross = Math.abs(e.cy - r.cy); }
      if (dir === 'right') { if (e.cx <= r.cx + 4 || e.l < r.r - 8) return; main = e.l - r.r; cross = Math.abs(e.cy - r.cy); }
      if (dir === 'up') { if (e.cy >= r.cy - 4 || e.b > r.t + 8) return; main = r.t - e.b; cross = Math.abs(e.cx - r.cx); }
      if (dir === 'down') { if (e.cy <= r.cy + 4 || e.t < r.b - 8) return; main = e.t - r.b; cross = Math.abs(e.cx - r.cx); }
      var score = Math.max(0, main) + cross * (dir === 'left' || dir === 'right' ? 3 : 0.6);
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (!best) return;
    if (dir === 'up' || dir === 'down') {
      var row = rowOf(best);
      if (row && row !== curRow) {
        var mem = S.lastFocus[rowKey(row)];
        if (mem && document.body.contains(mem) && rowOf(mem) === row) best = mem;
        if (row.classList.contains('ptabs')) best = row.querySelector('.ptab.on') || best;
      }
    }
    focusEl(best);
  }
  function activate(el) {
    if (!el) return;
    var act = el.getAttribute('data-action');
    var app = el.getAttribute('data-app');
    var pkg = el.getAttribute('data-pkg');
    var it = el.getAttribute('data-item');
    var open = el.getAttribute('data-open');
    var tab = el.getAttribute('data-tab');
    var pin = el.getAttribute('data-pin');
    if (pin) return pinKey(pin);
    if (tab) { S.tab = tab; renderParents(); var t = root().querySelector('.ptab[data-tab="' + tab + '"]'); if (t) focusEl(t); return; }
    if (app) return openApp(app, el.getAttribute('data-label'));
    if (pkg) { if (!A.launch(pkg)) toast('Couldn’t open that app'); return; }
    if (open && items[open]) return openService(items[open]);
    if (it && items[it]) return openDetail(items[it]);
    switch (act) {
      case 'kids': return chooseKids();
      case 'featured': return openFeatured();
      case 'parents': return askPin(function () { S.tab = 'home'; renderParents(); show('parents'); });
      case 'grownups': return askPin(function () { S.tab = 'home'; renderParents(); show('parents'); });
      case 'switch': return show('picker');
      case 'settings': return openSettings();
      case 'close': return closeOverlay();
      case 'fire-settings': return A.openSettings();
      case 'refresh':
        try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('tmdb:') === 0) localStorage.removeItem(k); }); } catch (e) { }
        closeOverlay(true); renderParents(); toast('Refreshing…'); return;
      case 'pin':
        closeOverlay(true);
        return askPin(function () { S.pinMode = 'create1'; S.pinBuf = ''; S.after = function () { S.tab = 'home'; renderParents(); show('parents'); }; renderPin(); show('pin'); });
    }
  }
  app.back = function () {
    if (S.overlay) return closeOverlay();
    if (S.screen === 'pin') return show('picker');
    if (S.screen === 'parents' && S.tab !== 'home') { S.tab = 'home'; renderParents(); setTimeout(focusFirst, 30); return; }
    if (S.screen === 'kids' || S.screen === 'parents') return show('picker');
  };
  app.onWake = function (relock) {
    loadApps();
    if (relock) { S.icons = {}; show('picker'); return; }
    if (S.screen === 'kids') renderKids();
  };
  app.reload = function () { if (S.screen === 'parents') renderParents(); if (S.screen === 'kids') renderKids(); };

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[k]) { e.preventDefault(); move(map[k]); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); activate(document.activeElement); return; }
    if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack') { e.preventDefault(); app.back(); }
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-nav]');
    if (el) { e.preventDefault(); focusEl(el); activate(el); }
  });
  document.addEventListener('mousedown', function (e) { if (!e.target.closest('[data-nav]')) e.preventDefault(); });

  // ---------------------------------------------------------------- browser preview without a TV
  function mockBridge() {
    var pin = null;
    var apps = [['com.netflix.ninja', 'Netflix'], ['com.amazon.firebat', 'Prime Video'], ['com.amazon.firetv.youtube', 'YouTube'], ['com.disney.disneyplus', 'Disney+'], ['au.net.abc.iview', 'ABC iview'], ['au.com.tenplay', '10 Play'], ['com.swm.live', '7plus'], ['au.com.ninenow.ctv', '9Now'], ['com.sbs.ondemand.tv', 'SBS On Demand'], ['eu.siptv.video', 'Smart IPTV'], ['com.hbo.hbonow', 'HBO Max'], ['tv.twitch.android.viewer', 'Twitch'], ['com.FDGEntertainment.RedBall4.amazon', 'Red Ball 4'], ['com.mathsgame.mathfun', 'Math Fun']];
    return {
      getApps: function () { return JSON.stringify(apps.map(function (a) { return { pkg: a[0], label: a[1], tv: true }; })); },
      getIcon: function () { return ''; },
      launch: function (p) { toast('Would open ' + p); return true; },
      openUrl: function () { return true; },
      openSettings: function () { toast('Would open Fire TV settings'); },
      getVersion: function () { return 'preview'; },
      hasPin: function () { return pin !== null; },
      setPin: function (p) { pin = p; return true; },
      checkPin: function (p) { return p === pin ? 'ok' : 'bad'; },
      hasTmdbKey: function () { return false; },
      tmdb: function (path, id) { setTimeout(function () { app.tmdbDone(id, 0, ''); }, 10); }
    };
  }

  // ---------------------------------------------------------------- start
  window.addEventListener('resize', fit);
  fit();
  loadApps();
  tick();
  setInterval(tick, 20000);
  show('picker');
})();
