(() => {
  'use strict';

  const get = id => document.getElementById(id);
  const links = [...document.querySelectorAll('[data-view]')];
  const views = new Set(links.map(link => link.dataset.view));
  const assets = JSON.parse(get('kit-embedded-assets').textContent);
  const teaching = get('metrics-teaching');
  const aliases = {
    playground: 'classification', classroom: 'classification',
    guide: 'handbook', downloads: 'handbook', sources: 'handbook',
  };
  const guideSections = {
    'guide-tools': 'metrics-reference',
    'guide-data': 'metrics-reference',
    'guide-math': 'classification-reference',
    'guide-hands-on': 'downloads',
    'guide-sources': 'sources',
    downloads: 'downloads',
    sources: 'sources',
  };

  function showRoute() {
    const route = location.hash.slice(1);
    const section = guideSections[route];
    const match = views.has(route) ? route : section ? 'handbook' : aliases[route];
    const current = match || 'classification';
    for (const view of views) get('view-' + view).hidden = view !== current;
    for (const link of links) {
      if (link.dataset.view === current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (current === 'board') requestAnimationFrame(() => window.MetricsBoard?.resize());
    if (section) {
      requestAnimationFrame(() => get(section)?.scrollIntoView());
    } else {
      window.scrollTo(0, 0);
    }
  }

  function save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  teaching.addEventListener('click', () => {
    const active = document.body.classList.toggle('teaching-metrics');
    teaching.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-kit-asset]').forEach(button => {
    button.addEventListener('click', () => {
      const { b64, mime } = assets[button.dataset.kitAsset];
      const bytes = Uint8Array.from(atob(b64), char => char.charCodeAt(0));
      save(new Blob([bytes], { type: mime }), button.dataset.kitAsset);
    });
  });
  get('save-offline-kit').addEventListener('click', () => {
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll('details[open]').forEach(details => details.removeAttribute('open'));
    copy.querySelectorAll('[data-offline-href]').forEach(link => { link.href = link.dataset.offlineHref; });
    save(new Blob(['<!doctype html>\n', copy.outerHTML], { type: 'text/html;charset=utf-8' }), 'classification-regression-metrics.html');
  });
  get('print-guide').addEventListener('click', () => window.print());
  window.addEventListener('hashchange', showRoute);
  showRoute();
})();
