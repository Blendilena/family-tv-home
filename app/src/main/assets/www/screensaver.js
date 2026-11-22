/* Family TV screensaver. Plain ES2017 for the Fire OS 7 WebView. */
(function () {
  'use strict';
  var C = window.FTV_CONFIG;
  var A = window.Android || {
    tmdb: function (p, id) { setTimeout(function () { app.tmdbDone(id, 0, ''); }, 10); },
    hasTmdbKey: function () { return false; }, getLastMode: function () { return 'family'; }, getWeatherPlace: function () { return ''; }
  };
  var IMG = 'https://image.tmdb.org/t/p/';
  var SLIDE_MS = 12000;
  var stage = document.getElementById('stage');
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fit() { var s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = Math.abs(s - 1) < 0.001 ? '' : 'scale(' + s + ')'; }

  // ---------------------------------------------------------------- clock (drifts a little to protect the screen)
  function tick() {
    var now = new Date();
    var t = now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    var d = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    Array.prototype.forEach.call(document.querySelectorAll('[data-clock]'), function (el) { el.textContent = el.getAttribute('data-clock') === 'date' ? d : t; });
  }
  function drift() {
    var dx = Math.round(Math.random() * 36 - 18), dy = Math.round(Math.random() * 30 - 15);
    $('ss-clock').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    $('ssk-card').style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-54% + ' + dy + 'px))';
  }

  // ---------------------------------------------------------------- weather (Open-Meteo, no key needed)
  function wIcon(code, day, size) {
    var sun = '<circle cx="12" cy="12" r="4.5" fill="#FFD84D"/><g stroke="#FFD84D" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g>';
    var moon = '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.2A7 7 0 0 1 15.5 3.5z" fill="#E8E3C8"/>';
    var cloud = '<path d="M7 18h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" fill="#E6EBF2"/>';
    var rain = '<g stroke="#6FC3FF" stroke-width="1.8" stroke-linecap="round"><path d="M9 20l-1 2.5M13 20l-1 2.5M17 20l-1 2.5"/></g>';
    var bolt = '<path d="M13 17l-3 5h3l-1 3 4-5h-3l1-3z" fill="#FFD84D"/>';
    var g;
    if (code === 0) g = day ? sun : moon;
    else if (code <= 2) g = '<g transform="translate(-3 -3) scale(.8)">' + (day ? sun : moon) + '</g>' + cloud;
    else if (code === 3 || code === 45 || code === 48) g = cloud;
    else if (code >= 95) g = cloud + bolt;
    else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) g = '<g transform="translate(0 -2)">' + cloud + '</g>' + rain;
    else if (code >= 71 && code <= 86) g = cloud + '<g fill="#FFFFFF"><circle cx="9" cy="21" r="1.2"/><circle cx="13" cy="22" r="1.2"/><circle cx="17" cy="21" r="1.2"/></g>';
    else g = cloud;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 26" aria-hidden="true">' + g + '</svg>';
  }
  function wWord(code) {
    if (code === 0) return 'Clear';
    if (code <= 2) return 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if (code === 45 || code === 48) return 'Foggy';
    if (code >= 95) return 'Storms';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 51 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 86) return 'Snow';
    return '';
  }
  function weather() {
    var place = '';
    try { place = A.getWeatherPlace ? A.getWeatherPlace() : ''; } catch (e) { place = ''; }
    var p = place.split('|');
    if (p.length < 3) return;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(p[1]) + '&longitude=' + encodeURIComponent(p[2]) +
      '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.current) return;
      var code = d.current.weather_code, day = d.current.is_day === 1;
      var t = Math.round(d.current.temperature_2m);
      var hi = d.daily ? Math.round(d.daily.temperature_2m_max[0]) : null, lo = d.daily ? Math.round(d.daily.temperature_2m_min[0]) : null;
      $('ss-weather').innerHTML = wIcon(code, day, 46) + '<span>' + t + '° ' + esc(wWord(code)) + '</span>' +
        '<small>' + esc(p[0]) + (hi != null ? ' · H ' + hi + '° L ' + lo + '°' : '') + '</small>';
      var fun = code === 0 && day ? 'sunny' : wWord(code).toLowerCase();
      $('ssk-weather').innerHTML = wIcon(code, day, 40) + '<span>It’s ' + t + '°' + (fun ? ' and ' + esc(fun) : '') + ' outside</span>';
    }).catch(function () { });
  }

  // ---------------------------------------------------------------- slideshow (top titles in Australia from TMDB)
  var cbs = {}, cbId = 0;
  var preview = /[?&]preview=1/.test(location.search);
  function leave() { if (preview) location.href = 'index.html'; }
  document.addEventListener('keydown', function (e) { e.preventDefault(); leave(); });
  window.app = { back: leave, onWake: function () { }, tmdbDone: function (id, code, body) {
    var cb = cbs[id]; delete cbs[id]; if (!cb) return;
    var data = null; try { data = code >= 200 && code < 300 ? JSON.parse(body) : null; } catch (e) { }
    cb(data);
  } };
  function tmdb(path) {
    var key = 'tmdb:' + path;
    try { var hit = JSON.parse(localStorage.getItem(key) || 'null'); if (hit && Date.now() - hit.t < C.cacheHours * 3600e3) return Promise.resolve(hit.d); } catch (e) { }
    return new Promise(function (res) {
      var id = 's' + (++cbId);
      cbs[id] = function (d) { if (d) { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { } } res(d); };
      A.tmdb(path, id);
    });
  }
  function list(kind, service) {
    var path = 'discover/' + kind + '?watch_region=' + C.region + '&with_watch_providers=' + C.providers[service] +
      '&with_watch_monetization_types=flatrate&include_adult=false&language=en-AU&sort_by=popularity.desc';
    return tmdb(path).then(function (d) {
      return ((d && d.results) || []).filter(function (it) { return it.backdrop_path; })
        .map(function (it) { it._kind = kind; it._service = service; return it; });
    });
  }
  var items = [], at = -1, flip = false, timer = 0;
  function build() {
    if (!A.hasTmdbKey()) return;
    Promise.all([list('movie', 'netflix'), list('movie', 'prime'), list('tv', 'netflix'), list('tv', 'prime')]).then(function (r) {
      function top(a, b) {
        var seen = {}, all = a.concat(b).filter(function (it) { if (seen[it.id]) return false; seen[it.id] = 1; return true; });
        all.sort(function (x, y) { return (y.popularity || 0) - (x.popularity || 0); });
        return all.map(function (it, i) { it._rank = i + 1; return it; });
      }
      var movies = top(r[0], r[1]).slice(0, 12), shows = top(r[2], r[3]).slice(0, 12);
      items = [];
      for (var i = 0; i < 12; i++) { if (movies[i]) items.push(movies[i]); if (shows[i]) items.push(shows[i]); }
      if (items.length) next();
    });
  }
  function next() {
    clearTimeout(timer);
    if (!items.length) return;
    at = (at + 1) % items.length;
    var it = items[at], url = IMG + 'w1280' + it.backdrop_path;
    var im = new Image();
    im.onload = function () {
      var a = $('ss-a'), b = $('ss-b'), inc = flip ? a : b, out = flip ? b : a;
      flip = !flip;
      inc.className = 'ss-layer';
      inc.style.backgroundImage = 'url(' + url + ')';
      void inc.offsetWidth;
      inc.className = 'ss-layer show kb' + (1 + (at % 4));
      out.classList.remove('show');
      var info = $('ss-info');
      info.classList.add('out');
      setTimeout(function () {
        var svc = it._service === 'prime' ? 'Prime Video' : 'Netflix', tv = it._kind === 'tv';
        var meta = [String(it.release_date || it.first_air_date || '').slice(0, 4), it.vote_average ? '★ ' + it.vote_average.toFixed(1) : '', tv ? 'Series' : 'Movie'].filter(Boolean).join(' · ');
        info.innerHTML = '<div class="ss-kicker">' + (it._rank <= 10 ? '<b>#' + it._rank + '</b>' : '') + (it._rank <= 10 ? 'Top ' + (tv ? 'series' : 'movie') + ' in Australia' : 'Popular in Australia') + ' · ' + svc + '</div>' +
          '<div class="ss-title">' + esc(it.title || it.name) + '</div><div class="ss-meta">' + esc(meta) + '</div>';
        info.classList.remove('out');
      }, 500);
      var bar = $('ss-bar'); bar.classList.remove('run'); void bar.offsetWidth; bar.style.animationDuration = SLIDE_MS + 'ms'; bar.classList.add('run');
      // warm the next picture
      var n = items[(at + 1) % items.length]; if (n) { var pre = new Image(); pre.src = IMG + 'w1280' + n.backdrop_path; }
      timer = setTimeout(next, SLIDE_MS);
    };
    im.onerror = function () { timer = setTimeout(next, 500); };
    im.src = url;
  }

  // ---------------------------------------------------------------- start
  var mode = 'family';
  try { mode = A.getLastMode ? A.getLastMode() : 'family'; } catch (e) { }
  if (/[?&]mode=(kids|family)/.test(location.search)) mode = RegExp.$1;   // for previews
  $(mode === 'kids' ? 'ss-kids' : 'ss-film').classList.add('active');
  window.addEventListener('resize', fit);
  fit(); tick(); drift();
  setInterval(tick, 10000);
  setInterval(drift, 60000);
  weather(); setInterval(weather, 20 * 60000);
  if (mode !== 'kids') build();
})();
