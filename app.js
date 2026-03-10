(() => {
  const state = { works: [], filtered: [] };

  const $ = (id) => document.getElementById(id);
  const grid = $('worksGrid');
  const q = $('worksQuery');

  const modal = $('modal');
  const modalImg = $('modalImg');
  const modalTitle = $('modalTitle');
  const modalMeta = $('modalMeta');
  const modalDesc = $('modalDesc');
  const closeBtn = $('closeModal');

  function safe(v) { return (v ?? '').toString(); }
  function titleFromFilename(name) {
    return safe(name)
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchWork(w, query) {
    const hay = [
      w.title, w.year, w.medium, w.size, w.series, (w.tags || []).join(' '), w.desc
    ].map(safe).join(' ').toLowerCase();
    return hay.includes(query);
  }

  function openModal(w) {
    modal.classList.add('open');
    modalImg.src = w.image || '';
    modalImg.alt = w.title || 'work';
    modalTitle.textContent = w.title || 'Untitled';
    modalMeta.textContent = [w.year, w.medium, w.size, w.series].filter(Boolean).join(' · ');
    modalDesc.textContent = w.desc || '';
  }

  function render(list) {
    if (!grid) return;
    grid.innerHTML = '';
    for (const w of list) {
      const card = document.createElement('div');
      card.className = 'item';
      card.tabIndex = 0;

      const thumb = document.createElement('div');
      thumb.className = 'thumb';

      const img = document.createElement('img');
      if (w.image) {
        img.src = w.image;
        img.loading = 'lazy';
        img.alt = w.title || 'work';
        img.style.display = 'block';
        thumb.appendChild(img);
      } else {
        thumb.textContent = 'No image yet';
        thumb.appendChild(img);
      }

      const meta = document.createElement('div');
      meta.className = 'meta';
      const t = document.createElement('p');
      t.className = 't';
      t.textContent = w.title || 'Untitled';
      const m = document.createElement('p');
      m.className = 'm';
      m.textContent = [w.year, w.medium, w.size].filter(Boolean).join(' · ') || '—';
      meta.appendChild(t);
      meta.appendChild(m);

      card.appendChild(thumb);
      card.appendChild(meta);

      card.addEventListener('click', () => openModal(w));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openModal(w); });
      grid.appendChild(card);
    }
  }

  function filter() {
    const query = (q?.value || '').trim().toLowerCase();
    state.filtered = query ? state.works.filter(w => matchWork(w, query)) : state.works;
    render(state.filtered);
  }

  async function loadFromGithubFolder() {
    const pagesOwner = (location.hostname || '').split('.')[0] || 'REALID-zz';
    const repoFromPath = (location.pathname || '').split('/').filter(Boolean)[0] || 'YOUNGmengzhen-official';
    const owners = [pagesOwner, 'REALID-zz'].filter((v, i, a) => v && a.indexOf(v) === i);
    const refs = ['main', 'master'];
    const repo = repoFromPath;
    const path = 'assets/works';

    for (const owner of owners) {
      for (const ref of refs) {
        const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
        const r = await fetch(api, { headers: { Accept: 'application/vnd.github+json' } });
        if (!r.ok) continue;
        const data = await r.json();
        if (!Array.isArray(data)) continue;
        const list = data
          .filter(x => x && x.type === 'file' && /\.(png|jpe?g|webp|gif)$/i.test(x.name || ''))
          .map(x => ({
            id: x.sha || x.name,
            title: titleFromFilename(x.name || ''),
            year: '',
            medium: '',
            size: '',
            series: '',
            tags: [],
            desc: '',
            image: x.download_url || ''
          }));
        if (list.length) return list;
      }
    }
    return [];
  }

  async function load() {
    try {
      const list = await loadFromGithubFolder();
      if (list.length) {
        state.works = list;
        filter();
        return;
      }
    } catch { /* ignore */ }

    state.works = [{
      title: '暂无作品图（请上传到 assets/works/）',
      desc: '上传后刷新本页会自动铺满（不需要分页）。'
    }];
    filter();
  }

  // Side nav scroll spy
  const spyLinks = Array.from(document.querySelectorAll('[data-spy]'));
  const spyMap = spyLinks
    .map(a => ({ a, id: (a.getAttribute('href') || '').replace('#', '') }))
    .filter(x => x.id);
  const sections = spyMap
    .map(x => document.getElementById(x.id))
    .filter(Boolean);

  function setActive(id){
    for (const x of spyMap){
      x.a.classList.toggle('active', x.id === id);
    }
  }

  if (sections.length){
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio - a.intersectionRatio))[0];
      const id = visible?.target?.id;
      if (id) setActive(id);
    }, { root: null, rootMargin: '-35% 0px -55% 0px', threshold: [0.05, 0.15, 0.25, 0.35, 0.5] });
    for (const s of sections) io.observe(s);
  }

  // Modal events
  closeBtn?.addEventListener('click', () => modal.classList.remove('open'));
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  q?.addEventListener('input', filter);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.classList.remove('open'); });

  load();
})();

