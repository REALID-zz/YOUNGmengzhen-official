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

  // Dynamic cursor + spotlight (desktop only)
  (function initCursor(){
    const fine = window.matchMedia?.('(pointer:fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const root = document.documentElement;
    root.classList.add('cursorOn');

    const flame = document.createElement('div');
    flame.className = 'cursorFlame';
    document.body.appendChild(flame);

    let tx = window.innerWidth * 0.3;
    let ty = window.innerHeight * 0.7;
    let ptx = tx, pty = ty;
    let raf = 0;
    let hover = false;

    const isHoverTarget = (el) => !!el?.closest?.('a, button, .btn, .pill, .item, summary, input, textarea');

    function tFlame(x, y, deg, s){
      // tip is closer to the pointer (slight upward offset)
      return `translate3d(${x}px, ${y}px, 0) translate(-50%, -92%) rotate(${deg}deg) scale(${s})`;
    }

    function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

    function frame(){
      // candle flicker (subtle + organic)
      const t = performance.now();
      const wave = Math.sin(t / 86) * Math.sin(t / 137);
      const rand = (Math.random() - 0.5) * 0.16;
      const f = clamp(0.92 + 0.18 * wave + rand, 0.76, 1.10);
      root.style.setProperty('--glowA', (0.14 + 0.16 * f).toFixed(3));
      root.style.setProperty('--glowB', (0.10 + 0.12 * f).toFixed(3));
      root.style.setProperty('--curA', (0.28 + 0.46 * f).toFixed(3));
      root.style.setProperty('--curB', (0.18 + 0.30 * f).toFixed(3));
      flame.style.opacity = (0.88 + 0.14 * f).toFixed(3);

      raf = requestAnimationFrame(frame);
    }

    function setSpotlight(px, py){
      root.style.setProperty('--mx', `${px}px`);
      root.style.setProperty('--my', `${py}px`);
    }

    window.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      setSpotlight(tx, ty);
      // flame snaps to pointer (with direction tilt)
      const dx = tx - ptx;
      const dy = ty - pty;
      ptx = tx; pty = ty;
      const speed = Math.hypot(dx, dy);
      // smaller tilt to keep click hotspot visually precise
      const tiltRaw = clamp(dx * 0.06, -7, 7) + clamp(-dy * 0.02, -4, 4);
      const tilt = hover ? 0 : tiltRaw;
      const base = clamp(0.92 + speed / 220, 0.92, 1.08);
      const s = hover ? base * 1.08 : base;
      flame.style.transform = tFlame(tx, ty, tilt, s);
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });

    window.addEventListener('pointerdown', () => root.classList.add('cursorHover'));
    window.addEventListener('pointerup', () => root.classList.remove('cursorHover'));
    window.addEventListener('pointerover', (e) => {
      hover = isHoverTarget(e.target);
      root.classList.toggle('cursorHover', hover);
    }, { passive: true });
    window.addEventListener('pointerout', (e) => {
      if (!isHoverTarget(e.relatedTarget)) { hover = false; root.classList.remove('cursorHover'); }
    }, { passive: true });

    // kickstart
    setSpotlight(tx, ty);
    flame.style.transform = tFlame(tx, ty, 0, 1);
    raf = requestAnimationFrame(frame);
  })();

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

  // --- Auto reorder works by "texture"/look (no manual metadata needed) ---
  function rgbToHslFast(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    let h = 0;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0){
      switch (max){
        case r: h = ((g - b) / d) % 6; break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, l };
  }

  async function analyzeImage(url){
    // Cache in-session to avoid recomputing on refreshes/filters
    const key = `feat:${url}`;
    try{
      const cached = sessionStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    }catch{ /* ignore */ }

    const img = new Image();
    // Same-origin images on GitHub Pages; keep safe if CORS ever changes
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    try{
      await img.decode();
    }catch{
      return null;
    }

    const size = 56;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // cover-fit into square
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(size / iw, size / ih);
    const sw = size / scale;
    const sh = size / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

    const { data } = ctx.getImageData(0, 0, size, size);
    const n = size * size;

    let lumSum = 0, lum2Sum = 0;
    let satSum = 0, hueX = 0, hueY = 0;
    let edgeSum = 0;

    // Luma plane for fast edge estimate
    const lum = new Float32Array(n);

    for (let i = 0; i < n; i++){
      const o = i * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lum[i] = l;
      lumSum += l;
      lum2Sum += l * l;

      const hsl = rgbToHslFast(r, g, b);
      satSum += hsl.s;
      const rad = (hsl.h * Math.PI) / 180;
      hueX += Math.cos(rad);
      hueY += Math.sin(rad);
    }

    // edge density: average neighbor diff (right + down)
    for (let y = 0; y < size; y++){
      const row = y * size;
      for (let x = 0; x < size; x++){
        const i = row + x;
        const v = lum[i];
        if (x + 1 < size) edgeSum += Math.abs(v - lum[i + 1]);
        if (y + 1 < size) edgeSum += Math.abs(v - lum[i + size]);
      }
    }

    const lumMean = lumSum / n;
    const lumVar = Math.max(0, lum2Sum / n - lumMean * lumMean);
    const lumStd = Math.sqrt(lumVar);
    const satMean = satSum / n;
    const hue = (Math.atan2(hueY, hueX) * 180 / Math.PI + 360) % 360;
    const edge = edgeSum / (2 * n); // normalized-ish

    const feat = {
      lum: +lumMean.toFixed(4),
      sat: +satMean.toFixed(4),
      hue: +hue.toFixed(2),
      con: +lumStd.toFixed(4),
      edge: +edge.toFixed(4),
    };

    try{
      sessionStorage.setItem(key, JSON.stringify(feat));
    }catch{ /* ignore */ }
    return feat;
  }

  function dist2(a, b){
    const de = a.edge - b.edge;
    const ds = a.sat - b.sat;
    const dl = a.lum - b.lum;
    const dc = a.con - b.con;
    // weighted: edge + sat matter most for "texture"
    return (de * de) * 1.8 + (ds * ds) * 1.6 + (dl * dl) * 1.0 + (dc * dc) * 0.9;
  }

  function meanOf(list){
    const n = list.length || 1;
    let edge = 0, sat = 0, lum = 0, con = 0, hueX = 0, hueY = 0;
    for (const f of list){
      edge += f.edge; sat += f.sat; lum += f.lum; con += f.con;
      const rad = (f.hue * Math.PI) / 180;
      hueX += Math.cos(rad);
      hueY += Math.sin(rad);
    }
    const hue = (Math.atan2(hueY, hueX) * 180 / Math.PI + 360) % 360;
    return { edge: edge / n, sat: sat / n, lum: lum / n, con: con / n, hue };
  }

  function pickInitCentroids(feats, k){
    // deterministic seeds to avoid "random" regrouping across refresh:
    // 1) min edge (soft/painterly), 2) max edge (liney), 3) max sat (vivid), 4) min lum (dark)
    const by = (key, dir) => [...feats].sort((a, b) => dir * (a[key] - b[key]))[0];
    const c = [];
    c.push(by('edge', +1));
    c.push(by('edge', -1));
    if (k >= 3) c.push(by('sat', -1));
    if (k >= 4) c.push(by('lum', +1));
    return c.slice(0, k).map(x => ({ ...x }));
  }

  function kmeans(feats, k){
    const n = feats.length;
    if (n === 0) return { assign: [], centroids: [] };
    const kk = Math.max(2, Math.min(k, n));
    let centroids = pickInitCentroids(feats, kk);
    let assign = new Array(n).fill(0);

    for (let iter = 0; iter < 8; iter++){
      let changed = false;
      // assign
      for (let i = 0; i < n; i++){
        let best = 0;
        let bestD = Infinity;
        for (let j = 0; j < kk; j++){
          const d = dist2(feats[i], centroids[j]);
          if (d < bestD){ bestD = d; best = j; }
        }
        if (assign[i] !== best){ assign[i] = best; changed = true; }
      }
      if (!changed && iter > 0) break;

      // update
      const buckets = Array.from({ length: kk }, () => []);
      for (let i = 0; i < n; i++) buckets[assign[i]].push(feats[i]);
      centroids = buckets.map((b, idx) => b.length ? meanOf(b) : centroids[idx]);
    }
    return { assign, centroids };
  }

  async function reorderWorksByTexture(list){
    const works = (list || []).filter(w => w && w.image);
    if (works.length < 6) return list;

    // Analyze in parallel (small list)
    const analyzed = await Promise.all(works.map(w => analyzeImage(w.image)));
    const featMap = new Map();
    for (let i = 0; i < works.length; i++){
      if (analyzed[i]) featMap.set(works[i].image, analyzed[i]);
    }

    // If too many failed, bail out
    const ok = Array.from(featMap.values()).length;
    if (ok < Math.max(4, Math.floor(works.length * 0.5))) return list;

    const featItems = works
      .map(w => ({ image: w.image, f: featMap.get(w.image) }))
      .filter(x => x.f);
    const featVec = featItems.map(x => x.f);

    const { assign, centroids } = kmeans(featVec, 4);
    // Map image -> cluster id (featVec order matches featItems order)
    const featImages = featItems.map(x => x.image);
    const clusterOfImage = new Map();
    for (let i = 0; i < featImages.length; i++){
      clusterOfImage.set(featImages[i], assign[i] ?? 0);
    }

    // Rank clusters by "look": painterly/soft first, then dark, then line-art, then vivid graphic.
    const ranks = centroids.map((c) => {
      const edgeHigh = c.edge > 0.095;
      const satHigh = c.sat > 0.26;
      const dark = c.lum < 0.38;
      const lineArt = edgeHigh && c.sat < 0.18;
      const vividGraphic = edgeHigh && satHigh;
      if (lineArt) return 2;
      if (vividGraphic) return 3;
      if (dark) return 1;
      return 0; // soft/painterly
    });

    const get = (w) => featMap.get(w.image) || { edge: 0, sat: 0, hue: 0, lum: 0.5, con: 0 };

    const sorted = [...list].sort((a, b) => {
      const fa = a?.image ? get(a) : null;
      const fb = b?.image ? get(b) : null;
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;

      const ca = clusterOfImage.get(a.image) ?? 9;
      const cb = clusterOfImage.get(b.image) ?? 9;
      const ra = ranks[ca] ?? 9;
      const rb = ranks[cb] ?? 9;
      if (ra !== rb) return ra - rb;
      if (ca !== cb) return ca - cb;

      // within cluster: hue → luminance → edge (keeps similar feel together)
      if (fa.hue !== fb.hue) return fa.hue - fb.hue;
      if (fa.lum !== fb.lum) return fa.lum - fb.lum;
      return fa.edge - fb.edge;
    });
    return sorted;
  }

  function filter() {
    const query = (q?.value || '').trim().toLowerCase();
    state.filtered = query ? state.works.filter(w => matchWork(w, query)) : state.works;
    render(state.filtered);
  }

  async function loadFromLocalManifest() {
    const url = `./assets/works/works.json?v=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    const list = data
      .filter(x => x && typeof x.file === 'string' && x.file)
      .map(x => ({
        id: x.file,
        title: titleFromFilename(x.file),
        year: '',
        medium: '',
        size: '',
        series: '',
        tags: [],
        desc: '',
        image: `./assets/works/${encodeURIComponent(x.file)}`
      }));
    return list;
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
      const local = await loadFromLocalManifest();
      if (local.length) {
        state.works = local;
        filter(); // fast initial render
        // then reorder by texture/look and rerender
        reorderWorksByTexture(state.works).then(sorted => {
          if (sorted && Array.isArray(sorted)) {
            state.works = sorted;
            filter();
          }
        });
        return;
      }
    } catch { /* ignore */ }

    try {
      const list = await loadFromGithubFolder();
      if (list.length) {
        state.works = list;
        filter(); // fast initial render
        reorderWorksByTexture(state.works).then(sorted => {
          if (sorted && Array.isArray(sorted)) {
            state.works = sorted;
            filter();
          }
        });
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

