// Token Radar dashboard: board, detail view, filters and a model sandbox.
// Reads window.RADAR from data.js only. No network, no fetch, no framework.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'No radar data loaded.'; return; }

  // The board splits exactly on the floor: every watchlist row holds
  // TVL at or above it, and every early row holds TVL below it, so the
  // set filter can tell the two apart from the TVL alone.
  var FLOOR = D.floor_usd;

  function money(n) {
    if (n === null || n === undefined) return '-';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '-';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ageText(d) { return d === null || d === undefined ? 'unknown' : d + 'd'; }

  // ---- header stats -------------------------------------------------------
  var top = D.rows[0];
  document.getElementById('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Live tokens</dt><dd>' + D.live_size + '</dd></div>' +
    '<div><dt>Top implied</dt><dd>' + money(top ? top.implied_value_usd : 0) + '</dd></div>' +
    '<div><dt>Snapshot</dt><dd style="font-size:15px">' + esc(D.as_of) + '</dd></div>';

  // ---- model box + sandbox -------------------------------------------------
  var M = D.model;
  var sandbox = { base: M.base_multiple, gw: M.growth_weight, cap: M.growth_cap, floor: M.growth_floor };
  function clampGrowth(g) { return Math.min(sandbox.cap, Math.max(sandbox.floor, g === null ? 0 : g)); }
  function implied(r) {
    var age = r.age_days === null ? M.unknown_age_days : r.age_days;
    var mat = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
    var ch = 1 + M.chain_step * Math.min(r.chains.length, M.chain_max);
    var g = 1 + (clampGrowth(r.change_7d) / 100) * sandbox.gw;
    return Math.max(1, Math.round(r.tvl_usd * sandbox.base * g * mat * ch));
  }
  function renderModel() {
    document.getElementById('model').innerHTML =
      '<h2>How the value is modelled (' + esc(D.model_version) + ')</h2>' +
      '<p>Implied value = TVL x <code>' + sandbox.base + '</code> x growth x maturity x chains. ' +
      'Growth is the 7-day TVL change clamped to ' + sandbox.floor + '%..' + sandbox.cap + '%, weighted x' + sandbox.gw + '. ' +
      'Maturity is 0.55 + age/1460 x 0.45, so a protocol that has run longest with no token scores highest. ' +
      'Each chain adds 3%, up to 5 chains. Nothing here names a protocol: the same formula scores every row.</p>' +
      '<p>Change the constants and the board re-ranks live. The published board uses the constants above.</p>' +
      '<div class="sandbox">' +
      '<label>Base multiple <input id="sb-base" type="number" step="0.01" min="0.01" max="1" value="' + sandbox.base + '"></label>' +
      '<label>Growth weight <input id="sb-gw" type="number" step="0.05" min="0" max="2" value="' + sandbox.gw + '"></label>' +
      '<label>Growth floor % <input id="sb-floor" type="number" step="5" min="-100" max="0" value="' + sandbox.floor + '"></label>' +
      '<label>Growth cap % <input id="sb-cap" type="number" step="10" min="0" max="500" value="' + sandbox.cap + '"></label>' +
      '<button id="sb-reset" type="button">Reset to published model</button>' +
      '</div>';
    document.getElementById('sb-base').addEventListener('input', function (e) { sandbox.base = parseFloat(e.target.value) || M.base_multiple; render(); });
    document.getElementById('sb-gw').addEventListener('input', function (e) { sandbox.gw = parseFloat(e.target.value) || 0; render(); });
    document.getElementById('sb-floor').addEventListener('input', function (e) { sandbox.floor = parseFloat(e.target.value) || 0; render(); });
    document.getElementById('sb-cap').addEventListener('input', function (e) { sandbox.cap = parseFloat(e.target.value) || 0; render(); });
    document.getElementById('sb-reset').addEventListener('click', function () {
      sandbox = { base: M.base_multiple, gw: M.growth_weight, cap: M.growth_cap, floor: M.growth_floor };
      renderModel(); render();
    });
  }

  // ---- filters --------------------------------------------------------------
  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  var cats = {}, chains = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) { catSel.add(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { chainSel.add(new Option(c, c)); });

  var selected = null;
  function visibleRows() {
    var q = document.getElementById('q').value.trim().toLowerCase();
    var cat = catSel.value, ch = chainSel.value, set = document.getElementById('set').value;
    var sort = document.getElementById('sort').value;
    var rows = D.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (set === 'watchlist' && r.tvl_usd < FLOOR) return false;
      if (set === 'early' && r.tvl_usd >= FLOOR) return false;
      return true;
    });
    rows = rows.map(function (r) { return { r: r, v: implied(r) }; });
    var by = {
      implied: function (a, b) { return b.v - a.v; },
      tvl: function (a, b) { return b.r.tvl_usd - a.r.tvl_usd; },
      growth: function (a, b) { return (b.r.change_7d || 0) - (a.r.change_7d || 0); },
      age: function (a, b) { return (b.r.age_days || 0) - (a.r.age_days || 0); },
      name: function (a, b) { return a.r.name < b.r.name ? -1 : 1; },
    }[sort];
    rows.sort(by);
    return rows;
  }

  function render() {
    var list = visibleRows();
    var tb = document.getElementById('rows');
    tb.innerHTML = list.map(function (x, i) {
      var r = x.r;
      var cls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      var badge = r.tvl_usd >= FLOOR ? '<span class="badge wl">watchlist</span>' : '<span class="badge">early</span>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + badge + '<br><span style="color:var(--muted)">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '-') + '</td>' +
        '<td>' + esc(r.chains.join(', ') || '-') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(x.v) + '</strong></td></tr>';
    }).join('');
    document.getElementById('count').textContent = list.length + ' of ' + D.board_size + ' rows shown. Click a row for its detail and farm plan.';
    tb.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { select(tr.getAttribute('data-slug')); });
    });
    if (!selected || !list.some(function (x) { return x.r.slug === selected; })) {
      if (list.length) select(list[0].r.slug, true);
    } else {
      showDetail(selected);
    }
  }

  function select(slug, silent) {
    selected = slug;
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.classList.toggle('sel', tr.getAttribute('data-slug') === slug);
    });
    showDetail(slug);
  }

  function showDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var v = implied(r);
    var base = Math.round(r.tvl_usd * sandbox.base);
    var age = r.age_days === null ? M.unknown_age_days : r.age_days;
    var mat = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
    var ch = 1 + M.chain_step * Math.min(r.chains.length, M.chain_max);
    var g = 1 + (clampGrowth(r.change_7d) / 100) * sandbox.gw;
    document.getElementById('detail').innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="meta">' + esc(r.slug) + ' &middot; ' + esc(r.category || 'no category') + ' &middot; ' + esc(r.chains.join(', ') || 'no chain listed') + '</p>' +
      '<dl>' +
      '<dt>Implied value</dt><dd><strong>' + money(v) + '</strong></dd>' +
      '<dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd>' +
      '<dt>7-day change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '<dt>Age</dt><dd>' + ageText(r.age_days) + (r.listed_at ? ' (since ' + esc(r.listed_at) + ')' : '') + '</dd>' +
      '<dt>Token status</dt><dd>records no token</dd>' +
      '<dt>Published rank</dt><dd>#' + r.rank + ' of ' + D.board_size + '</dd>' +
      '</dl>' +
      '<p class="formula">Base ' + money(base) + ' x growth ' + g.toFixed(2) + ' x maturity ' + mat.toFixed(2) + ' x chains ' + ch.toFixed(2) + ' = ' + money(v) + '</p>' +
      '<h3>Farm plan</h3><ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="meta">The plan is a suggestion, not a promise: a protocol may never issue a token, and farming costs gas.</p>';
  }

  // ---- live table -------------------------------------------------------------
  document.getElementById('live-rows').innerHTML = D.live.map(function (r) {
    var cls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
    return '<tr><td><strong>' + esc(r.name) + '</strong><br><span style="color:var(--muted)">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '-') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + money(r.mcap_usd) + '</td>' +
      '<td class="num ' + cls + '">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  document.getElementById('foot').textContent =
    'Snapshot ' + D.as_of + ' from ' + D.source + '. ' +
    'Implied values are this radar\'s own claim from TVL, 7-day change, age and chain count; ' +
    'they are not a prediction that a token will be issued or what it will be worth. ' +
    'A protocol is shown as pre-token because its record carries no token, not because it has none.';

  ['q', 'cat', 'chain', 'set', 'sort'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });

  renderModel();
  render();
})();
