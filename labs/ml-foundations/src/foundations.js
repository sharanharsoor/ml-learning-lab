(() => {
  'use strict';

  const get = id => document.getElementById(id);
  const json = id => JSON.parse(get(id).textContent);
  const bike = json('foundation-bike-data');
  const unitOne = json('foundations-unit-1-data');
  const downloads = json('foundation-downloads');
  window.Foundations = Object.freeze({ bike, unitOne });

  const pages = [...document.querySelectorAll('.course-page')];
  const railLinks = [...document.querySelectorAll('.course-rail a')];
  const selector = get('course-unit');
  const previous = [get('previous-unit'), get('bottom-previous')];
  const next = [get('next-unit'), get('bottom-next')];
  const teaching = get('teaching-view');
  let active = -1;

  function show(index, focus = false) {
    if (index === active) return;
    active = index;
    const current = pages[index];
    pages.forEach(page => { page.hidden = page !== current; });
    for (const link of railLinks) {
      if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    selector.value = current.id;
    for (const button of previous) button.disabled = index === 0;
    for (const button of next) {
      button.disabled = index === pages.length - 1;
      button.textContent = index === pages.length - 2 ? 'Course outline' : 'Next unit';
    }
    get('course-position').textContent = current.id === 'course' ? 'Course outline' : `Unit ${index + 1} of 4`;
    if (focus) {
      window.scrollTo(0, 0);
      const heading = get(current.getAttribute('aria-labelledby'));
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function select(index) {
    const page = pages[index];
    if (!page || index === active) return;
    location.hash = page.id;
    show(index, true);
  }

  function readHash(focus) {
    const index = pages.findIndex(page => '#' + page.id === location.hash);
    if (index !== -1) show(index, focus);
    else if (active === -1) show(0);
  }

  for (const button of previous) button.addEventListener('click', () => select(active - 1));
  for (const button of next) button.addEventListener('click', () => select(active + 1));
  selector.addEventListener('change', () => select(pages.findIndex(page => page.id === selector.value)));
  window.addEventListener('hashchange', () => readHash(true));
  readHash(false);

  teaching.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('teaching');
    teaching.setAttribute('aria-pressed', String(enabled));
  });

  function save(href, name) {
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  }

  for (const button of document.querySelectorAll('[data-download]')) {
    button.addEventListener('click', () => {
      const name = button.dataset.download;
      const { data, type } = downloads[name];
      const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      save(url, name);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  get('download-foundations').addEventListener('click', () => {
    const url = new URL(location.href);
    url.hash = '';
    save(url.href, 'ML Foundations Teaching Lab.html');
  });
})();
