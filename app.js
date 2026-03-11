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

  // Desktop-like dock button for digital works
  (function initDeskDock(){
    const dock = $('deskDock');
    const btn = $('deskBtn');
    const drawer = $('deskDrawer');
    const closeDesk = $('closeDesk');
    const gridEl = $('deskGrid');
    const emptyEl = $('deskEmpty');
    const hint = $('deskHint');

    const viewer = $('deskViewer');
    const viewerMedia = $('deskViewerMedia');
    const viewerTitle = $('deskViewerTitle');
    const viewerMeta = $('deskViewerMeta');
    const viewerDesc = $('deskViewerDesc');
    const closeViewer = $('closeDeskViewer');

    if (!dock || !btn || !drawer || !gridEl || !emptyEl) return;

    const KEY = 'deskDockPos:v3';
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    let userPinned = false;

    function deskRect(){
      // Desk/table region derived from your hero photo composition:
      // keep the dock on the tabletop area (right side), never off-screen.
      const w = dock.offsetWidth || 64;
      const h = dock.offsetHeight || 64;
      const W = window.innerWidth;
      const H = window.innerHeight;
      return {
        // extend to left so it can sit on the tabletop near your arrow target
        left: W * 0.02,
        right: W * 0.96 - w,
        top: H * 0.78,
        bottom: H * 0.95 - h,
      };
    }

    function withinDesk(left, top){
      const r = deskRect();
      return (
        typeof left === 'number' && typeof top === 'number' &&
        left >= r.left && left <= r.right &&
        top >= r.top && top <= r.bottom
      );
    }

    function placeOnDesk(){
      // Hard anchor inside the desk region.
      const w = dock.offsetWidth || 64;
      const h = dock.offsetHeight || 64;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const r = deskRect();
      // anchor point: match your screenshot arrow tip (normalized)
      const ax = W * 0.037;
      const ay = H * 0.768;
      let left = ax - w * 0.5;
      let top = ay - h * 0.5;
      left = clamp(left, r.left, r.right);
      top = clamp(top, r.top, r.bottom);

      dock.style.left = `${Math.round(left)}px`;
      dock.style.top = `${Math.round(top)}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
    }

    function setDrawerOpen(open){
      drawer.hidden = !open;
      drawer.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) drawer.focus?.();
    }

    function setViewerOpen(open){
      if (!viewer) return;
      viewer.classList.toggle('open', open);
      if (!open && viewerMedia) viewerMedia.innerHTML = '';
    }

    function guessKind(file){
      const f = (file || '').toLowerCase();
      if (/\.(mp4|webm|mov)$/i.test(f)) return 'video';
      if (/\.(png|jpe?g|webp|gif)$/i.test(f)) return 'image';
      return 'file';
    }

    async function loadDigital(){
      try{
        const r = await fetch(`./assets/digital/works.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return [];
        const data = await r.json();
        if (!Array.isArray(data)) return [];
        const list = data
          .filter(x => x && typeof x.file === 'string' && x.file)
          .map(x => ({
            file: x.file,
            title: (typeof x.title === 'string' && x.title.trim()) ? x.title.trim() : titleFromFilename(x.file),
            year: (typeof x.year === 'string' ? x.year : ''),
            medium: (typeof x.medium === 'string' ? x.medium : ''),
            desc: (typeof x.desc === 'string' ? x.desc : ''),
            kind: guessKind(x.file),
            url: `./assets/digital/${encodeURIComponent(x.file)}`
          }));
        return list;
      } catch {
        return [];
      }
    }

    async function loadDigitalFromGithubFolder(){
      try{
        const pagesOwner = (location.hostname || '').split('.')[0] || 'REALID-zz';
        const repoFromPath = (location.pathname || '').split('/').filter(Boolean)[0] || 'YOUNGmengzhen-official';
        const owners = [pagesOwner, 'REALID-zz'].filter((v, i, a) => v && a.indexOf(v) === i);
        const refs = ['main', 'master'];
        const repo = repoFromPath;
        const path = 'assets/digital';

        const okExt = /\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i;

        for (const owner of owners){
          for (const ref of refs){
            const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
            const r = await fetch(api, { headers: { Accept: 'application/vnd.github+json' } });
            if (!r.ok) continue;
            const data = await r.json();
            if (!Array.isArray(data)) continue;
            const list = data
              .filter(x => x && x.type === 'file' && okExt.test(x.name || '') && (x.name || '') !== 'works.json')
              .map(x => ({
                file: x.name || '',
                title: titleFromFilename(x.name || ''),
                year: '',
                medium: '',
                desc: '',
                kind: guessKind(x.name || ''),
                url: x.download_url || ''
              }))
              .filter(x => x.file && x.url);
            if (list.length) return list;
          }
        }
        return [];
      }catch{
        return [];
      }
    }

    function openDigital(item){
      if (!viewer || !viewerMedia) return;
      viewerTitle.textContent = item.title || 'Digital';
      viewerMeta.textContent = [item.year, item.medium].filter(Boolean).join(' · ');
      viewerDesc.textContent = item.desc || '';
      viewerMedia.innerHTML = '';

      if (item.kind === 'video'){
        const v = document.createElement('video');
        v.src = item.url;
        v.controls = true;
        v.playsInline = true;
        v.preload = 'metadata';
        v.style.maxWidth = '100%';
        v.style.maxHeight = '70vh';
        viewerMedia.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.title || 'digital work';
        viewerMedia.appendChild(img);
      }
      setViewerOpen(true);
    }

    function renderDigital(list){
      gridEl.innerHTML = '';
      const has = Array.isArray(list) && list.length > 0;
      emptyEl.style.display = has ? 'none' : 'block';
      if (!has) return;

      for (const it of list){
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'deskItem';
        b.setAttribute('aria-label', it.title || 'digital work');

        const thumb = document.createElement('div');
        thumb.className = 'deskThumb';

        if (it.kind === 'video'){
          const v = document.createElement('video');
          v.src = it.url;
          v.muted = true;
          v.playsInline = true;
          v.preload = 'metadata';
          thumb.appendChild(v);
        } else {
          const img = document.createElement('img');
          img.src = it.url;
          img.loading = 'lazy';
          img.alt = it.title || 'digital work';
          thumb.appendChild(img);
        }

        const cap = document.createElement('div');
        cap.className = 'deskCap';
        cap.textContent = it.title || 'Digital';

        b.appendChild(thumb);
        b.appendChild(cap);
        b.addEventListener('click', () => openDigital(it));
        gridEl.appendChild(b);
      }
    }

    // restore dock position
    try{
      const raw = localStorage.getItem(KEY);
      if (raw){
        const p = JSON.parse(raw);
        if (p && typeof p.left === 'number' && typeof p.top === 'number'){
          // Only accept saved position when it's still on the tabletop region.
          if (withinDesk(p.left, p.top)){
            dock.style.left = `${p.left}px`;
            dock.style.top = `${p.top}px`;
            dock.style.right = 'auto';
            dock.style.bottom = 'auto';
            userPinned = true;
          } else {
            localStorage.removeItem(KEY);
            // Defer placement one frame so size is available.
            requestAnimationFrame(placeOnDesk);
          }
        }
      } else {
        requestAnimationFrame(placeOnDesk);
      }
    }catch{ /* ignore */ }

    // ensure always on tabletop on resize (even if pinned)
    window.addEventListener('resize', () => {
      const r = deskRect();
      const cur = dock.getBoundingClientRect();
      const left = clamp(cur.left, r.left, r.right);
      const top = clamp(cur.top, r.top, r.bottom);
      dock.style.left = `${Math.round(left)}px`;
      dock.style.top = `${Math.round(top)}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
    }, { passive: true });

    // dragging + snap
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    btn.addEventListener('pointerdown', (e) => {
      // allow click + drag on fine pointers
      dragging = true;
      moved = false;
      btn.setPointerCapture?.(e.pointerId);
      const r = dock.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startLeft = r.left; startTop = r.top;
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && (Math.abs(dx) + Math.abs(dy) > 6)) moved = true;
      if (!moved) return;

      const w = dock.offsetWidth || 0;
      const h = dock.offsetHeight || 0;
      const r = deskRect();
      const left = clamp(startLeft + dx, r.left, r.right);
      const top = clamp(startTop + dy, r.top, r.bottom);
      dock.style.left = `${left}px`;
      dock.style.top = `${top}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
    }, { passive: true });

    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;

      const r = dock.getBoundingClientRect();
      let left = r.left;
      let top = r.top;
      const rr = deskRect();
      left = clamp(left, rr.left, rr.right);
      top = clamp(top, rr.top, rr.bottom);

      dock.style.left = `${left}px`;
      dock.style.top = `${top}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      userPinned = true;

      try{
        localStorage.setItem(KEY, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
      }catch{ /* ignore */ }
    }, { passive: true });

    btn.addEventListener('click', async () => {
      if (moved) return; // ignore click after drag
      const open = drawer.classList.contains('open');
      if (!open){
        let list = await loadDigital();
        if (!list.length) list = await loadDigitalFromGithubFolder();
        renderDigital(list);
      }
      setDrawerOpen(!open);
    });

    closeDesk?.addEventListener('click', () => setDrawerOpen(false));
    drawer.addEventListener('click', (e) => { if (e.target === drawer) setDrawerOpen(false); });

    closeViewer?.addEventListener('click', () => setViewerOpen(false));
    viewer?.addEventListener('click', (e) => { if (e.target === viewer) setViewerOpen(false); });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (viewer?.classList.contains('open')) setViewerOpen(false);
      else if (drawer.classList.contains('open')) setDrawerOpen(false);
    });
  })();

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
    // dominant hue histogram (use saturated midtones)
    const bins = 36; // 10deg per bin
    const hueW = new Float32Array(bins);
    const satW = new Float32Array(bins);

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

      // dominant hue: focus on colorful pixels (but allow painterly low-sat color),
      // ignore near-gray and extreme shadows/highlights
      if (hsl.s > 0.10 && hsl.l > 0.06 && hsl.l < 0.94){
        const bin = Math.max(0, Math.min(bins - 1, Math.floor(hsl.h / 10)));
        const mid = 1 - Math.min(1, Math.abs(hsl.l - 0.5) * 1.25); // emphasize midtones
        const w = (hsl.s ** 1.15) * (0.32 + 0.68 * mid);
        hueW[bin] += w;
        satW[bin] += hsl.s * w;
      }
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

    // pick dominant hue bin
    let bestBin = 0;
    let bestW = 0;
    for (let i = 0; i < bins; i++){
      if (hueW[i] > bestW){ bestW = hueW[i]; bestBin = i; }
    }
    const hueDom = bestW > 0.12 ? (bestBin * 10 + 5) : hue; // fallback to average hue
    const satDom = bestW > 0.12 ? (satW[bestBin] / Math.max(1e-6, hueW[bestBin])) : satMean;

    const feat = {
      lum: +lumMean.toFixed(4),
      sat: +satMean.toFixed(4),
      hue: +hue.toFixed(2),
      hueDom: +hueDom.toFixed(2),
      satDom: +satDom.toFixed(4),
      hueStrength: +bestW.toFixed(4),
      con: +lumStd.toFixed(4),
      edge: +edge.toFixed(4),
    };

    try{
      sessionStorage.setItem(key, JSON.stringify(feat));
    }catch{ /* ignore */ }
    return feat;
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

    const get = (w) => featMap.get(w.image) || { edge: 0, sat: 0, hue: 0, lum: 0.5, con: 0, hueStrength: 0 };

    // Color-first ordering:
    // - primary: colored (higher saturation) first, then monochrome/low-sat together
    // - within colored: hue → saturation → luminance
    // - within mono: luminance
    const monoCut = 0.10;
    const sorted = [...list].sort((a, b) => {
      const fa = a?.image ? get(a) : null;
      const fb = b?.image ? get(b) : null;
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;

      const aSat = (typeof fa.satDom === 'number' ? fa.satDom : fa.sat);
      const bSat = (typeof fb.satDom === 'number' ? fb.satDom : fb.sat);
      const aHue = (typeof fa.hueDom === 'number' ? fa.hueDom : fa.hue);
      const bHue = (typeof fb.hueDom === 'number' ? fb.hueDom : fb.hue);
      const aStr = (typeof fa.hueStrength === 'number' ? fa.hueStrength : 0);
      const bStr = (typeof fb.hueStrength === 'number' ? fb.hueStrength : 0);

      // only treat as monochrome when both saturation and hue-signal are weak
      const aMono = (aSat < monoCut) && (aStr < 0.12);
      const bMono = (bSat < monoCut) && (bStr < 0.12);
      if (aMono !== bMono) return aMono ? 1 : -1; // colored first

      if (!aMono) {
        if (aHue !== bHue) return aHue - bHue;
        if (aSat !== bSat) return bSat - aSat; // more vivid first
        if (fa.lum !== fb.lum) return fa.lum - fb.lum; // darker → lighter
        return (safe(a?.id || a?.title || '')).localeCompare(safe(b?.id || b?.title || ''));
      }

      // mono / low-sat
      if (fa.lum !== fb.lum) return fa.lum - fb.lum;
      return (safe(a?.id || a?.title || '')).localeCompare(safe(b?.id || b?.title || ''));
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

