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

  // ─── Visuals / Laser Canvas ───
  (function initVisuals(){
    const canvas = document.getElementById('laserCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W, H, dpr;
    let running = false;
    let mx = 0.5, my = 0.5;

    function resize(){
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = (e.clientY - r.top) / r.height;
    }, { passive: true });

    // ── Audio engine — Dom Dolla-style deep house (125 BPM) ──
    let ac = null, audioRefs = null, audioOn = false;
    let kickTimer = 0;
    const soundBtn = document.getElementById('soundToggle');
    let muted = false;
    const MASTER_VOL = 0.19;

    function initAudio(){
      if (audioOn) return;
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }

      if (ac.state === 'suspended'){
        const wake = () => { if (ac) ac.resume(); document.removeEventListener('click', wake); document.removeEventListener('touchstart', wake); document.removeEventListener('scroll', wake); };
        document.addEventListener('click', wake); document.addEventListener('touchstart', wake); document.addEventListener('scroll', wake);
      }

      const BPM = 125;
      const s16 = 60 / BPM / 4;
      const swingAmt = s16 * 0.045;

      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4;
      comp.attack.value = 0.002; comp.release.value = 0.10;
      const master = ac.createGain(); master.gain.value = muted ? 0 : MASTER_VOL;
      comp.connect(master); master.connect(ac.destination);

      const dly = ac.createDelay(); dly.delayTime.value = s16 * 3;
      const dlyFb = ac.createGain(); dlyFb.gain.value = 0.28;
      const dlyW = ac.createGain(); dlyW.gain.value = 0.18;
      dly.connect(dlyFb); dlyFb.connect(dly); dly.connect(dlyW); dlyW.connect(comp);

      function noiseBuf(dur, dec){
        const len = Math.round(ac.sampleRate * dur);
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * dec));
        return buf;
      }
      const clpBuf = noiseBuf(0.12, 0.04);
      const chBuf  = noiseBuf(0.035, 0.010);
      const ohBuf  = noiseBuf(0.18, 0.065);

      let _padG = null;

      function doKick(t){
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(26, t + 0.08);
        g.gain.setValueAtTime(0.78, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + 0.52);
        const c = ac.createOscillator(); const cg = ac.createGain();
        c.frequency.setValueAtTime(4500, t);
        c.frequency.exponentialRampToValueAtTime(120, t + 0.007);
        cg.gain.setValueAtTime(0.11, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.009);
        c.connect(cg); cg.connect(comp); c.start(t); c.stop(t + 0.015);
        if (_padG){ _padG.gain.setValueAtTime(0.006, t); _padG.gain.linearRampToValueAtTime(0.032, t + 0.18); }
      }

      function doClap(t){
        const n = ac.createBufferSource(); n.buffer = clpBuf;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
        const g = ac.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        n.connect(f); f.connect(g); g.connect(comp); n.start(t);
      }

      function doHat(t, open){
        const n = ac.createBufferSource(); n.buffer = open ? ohBuf : chBuf;
        const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = open ? 6500 : 8500;
        const g = ac.createGain(); g.gain.value = open ? 0.055 : 0.04;
        n.connect(f); f.connect(g); g.connect(comp); n.start(t);
      }

      function doBass(t, freq){
        const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
        const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = freq * 0.998;
        const f = ac.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(75, t + s16 * 1.6); f.Q.value = 6;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.15, t); g.gain.setValueAtTime(0.15, t + s16 * 1.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + s16 * 1.8);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(comp);
        o1.start(t); o2.start(t); o1.stop(t + s16 * 2); o2.stop(t + s16 * 2);
      }

      function doStab(t, freq){
        const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
        const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.502;
        const o3 = ac.createOscillator(); o3.type = 'sawtooth'; o3.frequency.value = freq * 2.001;
        const f = ac.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(2800, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.14); f.Q.value = 3;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        o1.connect(f); o2.connect(f); o3.connect(f); f.connect(g); g.connect(comp); g.connect(dly);
        o1.start(t); o2.start(t); o3.start(t);
        o1.stop(t + 0.20); o2.stop(t + 0.20); o3.stop(t + 0.20);
      }

      function doPerc(t){
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(800, t);
        o.frequency.exponentialRampToValueAtTime(300, t + 0.03);
        g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + 0.06);
      }

      const padNotes = [130.81, 164.81, 196.00, 261.63];
      const padF = ac.createBiquadFilter();
      padF.type = 'lowpass'; padF.frequency.value = 280; padF.Q.value = 2.5;
      _padG = ac.createGain(); _padG.gain.value = 0.032;
      padF.connect(_padG); _padG.connect(comp);
      const padOscs = [];
      for (const n of padNotes){
        const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = n;
        const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = n * 1.005;
        o1.connect(padF); o2.connect(padF); o1.start(); o2.start();
        padOscs.push(o1, o2);
      }
      const alphaLFO = ac.createOscillator();
      alphaLFO.type = 'sine'; alphaLFO.frequency.value = 10;
      const alphaG = ac.createGain(); alphaG.gain.value = 0.20;
      alphaLFO.connect(alphaG);
      for (const o of padOscs) alphaG.connect(o.frequency);
      alphaLFO.start(); padOscs.push(alphaLFO);

      const binL = ac.createOscillator(); binL.type = 'sine'; binL.frequency.value = 200;
      const binR = ac.createOscillator(); binR.type = 'sine'; binR.frequency.value = 210;
      const merger = ac.createChannelMerger(2);
      binL.connect(merger, 0, 0); binR.connect(merger, 0, 1);
      const binG = ac.createGain(); binG.gain.value = 0.018;
      merger.connect(binG); binG.connect(master);
      binL.start(); binR.start(); padOscs.push(binL, binR);

      const sweepLFO = ac.createOscillator();
      sweepLFO.type = 'sine'; sweepLFO.frequency.value = BPM / (60 * 16);
      const sweepDepth = ac.createGain(); sweepDepth.gain.value = 380;
      sweepLFO.connect(sweepDepth); sweepDepth.connect(padF.frequency);
      sweepLFO.start(); padOscs.push(sweepLFO);

      const kickP = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0];
      const clapP = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
      const chP   = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1];
      const ohP   = [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0];
      const percP = [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0];
      const bassP = [87.31,0,0,87.31, 0,0,87.31,0, 0,87.31,0,0, 87.31,0,0,0];
      const stabP = [
        0,0,0,0, 0,0,0,0, 261.63,0,0,0, 0,0,0,0,
        0,0,0,0, 0,0,0,0, 0,0,0,0, 196.00,0,0,0
      ];

      let step = 0, next = ac.currentTime + 0.05;
      (function loop(){
        if (!audioOn || !ac) return;
        while (next < ac.currentTime + 0.2){
          const s = step % 16, s2 = step % 32;
          const ts = (s % 2 === 1) ? next + swingAmt : next;
          if (kickP[s]) doKick(next);
          if (clapP[s]) doClap(next);
          if (chP[s]) doHat(ts, false);
          if (ohP[s]) doHat(ts, true);
          if (percP[s]) doPerc(ts);
          if (bassP[s]) doBass(next, bassP[s]);
          if (stabP[s2]) doStab(next, stabP[s2]);
          step++; next += s16;
        }
        kickTimer = setTimeout(loop, 50);
      })();

      audioRefs = { master, padF, padOscs };
      audioOn = true;
      if (soundBtn){ soundBtn.classList.add('active'); }
    }

    function stopAudio(){
      audioOn = false;
      clearTimeout(kickTimer);
      if (audioRefs && ac){
        audioRefs.master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
        if (audioRefs.padOscs) audioRefs.padOscs.forEach(o => { try { o.stop(); } catch {} });
      }
      setTimeout(() => { try { if (ac) ac.close(); } catch {} ac = null; audioRefs = null; }, 600);
    }

    if (soundBtn){
      soundBtn.addEventListener('click', () => {
        if (!audioOn){ initAudio(); muted = false; soundBtn.textContent = 'MUTE'; soundBtn.classList.add('active'); return; }
        if (muted){
          muted = false;
          audioRefs.master.gain.linearRampToValueAtTime(MASTER_VOL, ac.currentTime + 0.3);
          soundBtn.textContent = 'MUTE';
          soundBtn.classList.add('active');
        } else {
          muted = true;
          audioRefs.master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
          soundBtn.textContent = 'UNMUTE';
          soundBtn.classList.remove('active');
        }
      });
    }

    // ── Beat system (122 BPM, synced to audio) ──
    const BEAT_MS = 60000 / 122;
    function getBeat(t){
      const b = t / BEAT_MS;
      const frac = b % 1;
      const num = (b | 0);
      const pulse = Math.exp(-frac * 6);
      return { pulse, isBar: (num % 4 === 0), isDrop: (num % 32 === 0) && frac < 0.06, frac };
    }

    // ── Multi-color beams ──
    const G  = [173, 203, 65];
    const CY = [65, 210, 190];
    const WW = [255, 245, 225];
    const PU = [160, 90, 220];

    const beams = [
      { ox: 0.06, sweep: 28, speed: 0.30, phase: 0.0, bright: 0.88, c: G },
      { ox: 0.20, sweep: 14, speed: 0.18, phase: 0.9, bright: 0.42, c: CY },
      { ox: 0.34, sweep: 22, speed: 0.24, phase: 1.8, bright: 0.78, c: G },
      { ox: 0.48, sweep: 32, speed: 0.36, phase: 2.6, bright: 1.00, c: G },
      { ox: 0.56, sweep: 10, speed: 0.14, phase: 3.3, bright: 0.26, c: WW },
      { ox: 0.66, sweep: 24, speed: 0.28, phase: 4.0, bright: 0.72, c: G },
      { ox: 0.78, sweep: 18, speed: 0.32, phase: 4.8, bright: 0.50, c: CY },
      { ox: 0.88, sweep: 20, speed: 0.40, phase: 5.6, bright: 0.82, c: G },
      { ox: 0.42, sweep: 12, speed: 0.12, phase: 6.2, bright: 0.18, c: PU },
    ];

    // ── Particles (180) ──
    const PCNT = 180;
    const particles = [];
    for (let i = 0; i < PCNT; i++){
      particles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0004,
        vy: Math.random() * 0.00035 + 0.00006,
        size: Math.random() * 1.8 + 0.3,
        base: Math.random() * 0.10 + 0.015,
      });
    }

    // ── Film grain texture (pre-rendered) ──
    const GS = 128;
    const grainCvs = document.createElement('canvas');
    grainCvs.width = GS; grainCvs.height = GS;
    const gCtx = grainCvs.getContext('2d');
    const gImg = gCtx.createImageData(GS, GS);
    for (let i = 0; i < gImg.data.length; i += 4){
      const v = Math.random() * 255;
      gImg.data[i] = gImg.data[i+1] = gImg.data[i+2] = v;
      gImg.data[i+3] = 10;
    }
    gCtx.putImageData(gImg, 0, 0);

    // ── Hero character (pixel art) ──
    const heroImg = new Image();
    heroImg.crossOrigin = 'anonymous';
    heroImg.src = './assets/hero-char.png';
    let heroReady = false;
    heroImg.onload = () => { heroReady = true; };

    const charTrail = [];
    const charSparks = [];

    // ── Drawing helpers ──
    function drawBeam(sx, sy, ex, ey, w, a, col){
      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
      grad.addColorStop(0.35, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.65})`);
      grad.addColorStop(0.75, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.25})`);
      grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = grad; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
    }

    function beamAngle(b, t){
      return b.sweep * Math.sin(t * b.speed * 0.001 + b.phase) + (mx - b.ox) * 14;
    }

    // ── Main render loop ──
    function frame(t){
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      const bt = getBeat(t);
      const beatMul = 1 + bt.pulse * 0.38 * (bt.isBar ? 1.3 : 0.7);

      if (audioRefs && audioOn) audioRefs.padF.frequency.value = 250 + (1 - my) * 650;

      ctx.globalCompositeOperation = 'lighter';

      // Vertical beams (green, beat-reactive)
      for (const b of beams){
        const ang = beamAngle(b, t) * Math.PI / 180;
        const sx = b.ox * W, sy = -30;
        const len = Math.hypot(W, H) * 1.3;
        const ex = sx + Math.sin(ang) * len;
        const ey = sy + Math.cos(ang) * len;
        const br = b.bright * beatMul;
        drawBeam(sx, sy, ex, ey, 100, 0.005 * br, b.c);
        drawBeam(sx, sy, ex, ey, 48, 0.012 * br, b.c);
        drawBeam(sx, sy, ex, ey, 20, 0.032 * br, b.c);
        drawBeam(sx, sy, ex, ey, 8, 0.085 * br, b.c);
        drawBeam(sx, sy, ex, ey, 2.5, 0.22 * br, b.c);
      }

      // ── Morphing visual system ──
      if (heroReady){
        const cx = W * 0.5, cy = H * 0.5;
        const hue = (t * 0.02) % 360;

        const viewScale = Math.min(W, H) / Math.max(heroImg.naturalWidth, heroImg.naturalHeight);
        const baseScale = viewScale * 0.7;
        const breathe = 1 + Math.sin(t * 0.0006) * 0.015 + Math.sin(t * 0.0004) * 0.008;
        const beatPump = 1 + bt.pulse * 0.04 * (bt.isBar ? 1.3 : 0.5);
        const fScale = baseScale * breathe * beatPump;
        const charW = heroImg.naturalWidth * fScale;
        const charH = heroImg.naturalHeight * fScale;

        // Soft expanding echoes
        for (let i = 0; i < 6; i++){
          const echoT = ((t * 0.00008 + i * 0.167) % 1);
          const echoS = fScale * (1 + echoT * 3);
          const echoA = Math.pow(1 - echoT, 4) * 0.03;
          const ew = heroImg.naturalWidth * echoS, eh = heroImg.naturalHeight * echoS;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = echoA;
          ctx.translate(cx, cy);
          ctx.filter = `blur(${echoT * 40 + 8}px)`;
          ctx.drawImage(heroImg, -ew * 0.5, -eh * 0.5, ew, eh);
          ctx.restore();
        }

        // Radial energy pulse rings (green)
        for (let i = 0; i < 5; i++){
          const phase = ((t * 0.00028 + i * 0.2) % 1);
          const r = phase * Math.max(W, H) * 0.75;
          const a = Math.pow(1 - phase, 2.5) * 0.04 * beatMul;
          const grad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r);
          grad.addColorStop(0, 'rgba(173,203,65,0)');
          grad.addColorStop(0.5, `rgba(173,203,65,${a})`);
          grad.addColorStop(1, 'rgba(173,203,65,0)');
          ctx.fillStyle = grad;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillRect(0, 0, W, H);
        }

        // Green atmospheric haze (dual layer, mouse-reactive)
        ctx.globalCompositeOperation = 'screen';
        const hx = W * mx, hy = H * 0.52;
        const haze = ctx.createRadialGradient(hx, hy, 0, hx, hy, W * 0.45);
        haze.addColorStop(0, `rgba(173,203,65,${0.012 * beatMul})`);
        haze.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);

        const haze2 = ctx.createRadialGradient(W * 0.5, H * 0.72, 0, W * 0.5, H * 0.72, W * 0.55);
        haze2.addColorStop(0, `rgba(173,203,65,${0.006 * beatMul})`);
        haze2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = haze2; ctx.fillRect(0, 0, W, H);

        // Central atmospheric glow (green core)
        ctx.globalCompositeOperation = 'screen';
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.5);
        glow.addColorStop(0, `rgba(173,203,65,${0.028 * beatMul})`);
        glow.addColorStop(0.35, `rgba(65,210,190,${0.010 * beatMul})`);
        glow.addColorStop(0.7, `rgba(173,203,65,${0.004 * beatMul})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

        // Gentle wave distortion
        const sliceH = 4;
        const numSlices = Math.ceil(charH / sliceH);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.95;
        for (let s = 0; s < numSlices; s++){
          const srcY = (s / numSlices) * heroImg.naturalHeight;
          const srcSliceH = heroImg.naturalHeight / numSlices;
          const wave = Math.sin(t * 0.0008 + s * 0.08) * 2.5;
          ctx.drawImage(heroImg,
            0, srcY, heroImg.naturalWidth, srcSliceH,
            cx - charW * 0.5 + wave, cy - charH * 0.5 + s * sliceH,
            charW, sliceH);
        }
        ctx.restore();

        // Subtle chromatic aberration
        const abr = 1 + bt.pulse * 2.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.08;
        ctx.filter = 'blur(2px) hue-rotate(-60deg) saturate(2)';
        ctx.drawImage(heroImg, cx - charW * 0.5 + abr, cy - charH * 0.5, charW, charH);
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.08;
        ctx.filter = 'blur(2px) hue-rotate(160deg) saturate(2)';
        ctx.drawImage(heroImg, cx - charW * 0.5 - abr, cy - charH * 0.5, charW, charH);
        ctx.restore();

        // Core glow layers
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.08 + bt.pulse * 0.04;
        ctx.filter = 'blur(30px)';
        ctx.drawImage(heroImg, -charW * 0.5, -charH * 0.5, charW, charH);
        ctx.filter = 'blur(14px)';
        ctx.globalAlpha = 0.12 + bt.pulse * 0.05;
        ctx.drawImage(heroImg, -charW * 0.5, -charH * 0.5, charW, charH);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(heroImg, -charW * 0.5, -charH * 0.5, charW, charH);
        if (bt.isBar && bt.pulse > 0.7){
          ctx.globalAlpha = bt.pulse * 0.18;
          ctx.filter = 'blur(18px) brightness(2)';
          ctx.drawImage(heroImg, -charW * 0.5, -charH * 0.5, charW, charH);
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.restore();

        // Character sparks (green/cyan/white mix)
        if (bt.pulse > 0.8){
          const cnt = bt.isBar ? 4 : 1;
          const sparkCols = [G, CY, WW, [200,220,80]];
          for (let i = 0; i < cnt; i++){
            const ang = Math.random() * Math.PI * 2;
            const spd = 1.2 + Math.random() * 4;
            charSparks.push({
              x: cx + (Math.random() - 0.5) * charW * 0.4,
              y: cy + (Math.random() - 0.5) * charH * 0.4,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.8,
              life: 1, size: 1.2 + Math.random() * 3,
              c: sparkCols[Math.floor(Math.random() * sparkCols.length)]
            });
          }
        }
        for (let i = charSparks.length - 1; i >= 0; i--){
          const sp = charSparks[i];
          sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.02;
          sp.life -= 0.011;
          if (sp.life <= 0) charSparks.splice(i, 1);
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const sp of charSparks){
          ctx.globalAlpha = sp.life * 0.85;
          ctx.fillStyle = `rgb(${sp.c[0]},${sp.c[1]},${sp.c[2]})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // Ambient particles (green-tinted, proximity-lit)
      ctx.globalCompositeOperation = 'lighter';
      const pCols = [[173,203,65],[65,210,190],[255,245,225]];
      for (let pi = 0; pi < particles.length; pi++){
        const p = particles[pi];
        p.x += p.vx; p.y += p.vy;
        if (p.y > 1){ p.y = 0; p.x = Math.random(); }
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        const px = p.x * W, py = p.y * H;
        const dx = px - W * 0.5, dy = py - H * 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = Math.max(0, 1 - dist / (Math.max(W, H) * 0.5));
        const alpha = Math.min(0.55, p.base + proximity * 0.18 * beatMul);
        const pc = pCols[pi % 3];
        ctx.fillStyle = `rgba(${pc[0]},${pc[1]},${pc[2]},${alpha})`;
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, 6.283); ctx.fill();
      }

      // Strobe flash on drops
      if (bt.isDrop){
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(255,255,255,${0.12 * (1 - bt.frac / 0.06)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Film grain overlay
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.03;
      const gox = (Math.random() * GS) | 0, goy = (Math.random() * GS) | 0;
      for (let x = -gox; x < W; x += GS)
        for (let y = -goy; y < H; y += GS)
          ctx.drawImage(grainCvs, x, y);
      ctx.globalAlpha = 1;

      requestAnimationFrame(frame);
    }

    // ── Visibility observer (auto-start audio, pause canvas off-screen) ──
    const section = canvas.closest('.visualsSection');
    if (section && 'IntersectionObserver' in window){
      const io = new IntersectionObserver((entries) => {
        const vis = !!entries[0]?.isIntersecting;
        if (vis && !running){
          running = true;
          requestAnimationFrame(frame);
          if (!audioOn) initAudio();
        }
        else if (!vis){
          running = false;
        }
      }, { threshold: 0.02 });
      io.observe(section);
    } else {
      running = true;
      requestAnimationFrame(frame);
      if (!audioOn) initAudio();
    }

    const vGrid = document.getElementById('visualsGrid');
    const vEmpty = document.getElementById('visualsEmpty');
    if (!vGrid) return;

    function guessKind(f){
      if (/\.(mp4|webm|mov)$/i.test(f)) return 'video';
      return 'image';
    }

    async function loadVisualMedia(){
      try{
        const r = await fetch(`./assets/visuals/works.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return [];
        const data = await r.json();
        if (!Array.isArray(data)) return [];
        return data
          .filter(x => x && typeof x.file === 'string' && x.file)
          .map(x => ({
            file: x.file,
            title: (x.title || '').trim() || x.file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
            kind: guessKind(x.file),
            url: `./assets/visuals/${encodeURIComponent(x.file)}`
          }));
      } catch { return []; }
    }

    function openVisualViewer(item){
      const viewer = document.getElementById('deskViewer');
      const media = document.getElementById('deskViewerMedia');
      const title = document.getElementById('deskViewerTitle');
      const meta = document.getElementById('deskViewerMeta');
      if (!viewer || !media) return;
      title.textContent = item.title;
      meta.textContent = item.kind === 'video' ? 'Video' : 'Image';
      media.innerHTML = '';
      if (item.kind === 'video'){
        const v = document.createElement('video');
        v.src = item.url; v.controls = true; v.playsInline = true;
        v.style.maxWidth = '100%'; v.style.maxHeight = '70vh';
        media.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = item.url; img.alt = item.title;
        media.appendChild(img);
      }
      viewer.classList.add('open');
    }

    function renderVisualMedia(list){
      vGrid.innerHTML = '';
      if (!list.length){
        if (vEmpty) vEmpty.style.display = 'none';
        return;
      }
      if (vEmpty) vEmpty.style.display = 'none';

      for (const it of list){
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'visualsItem';
        card.setAttribute('aria-label', it.title);

        const thumb = document.createElement('div');
        thumb.className = 'visualsThumb';

        if (it.kind === 'video'){
          const v = document.createElement('video');
          v.src = it.url; v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.loop = true;
          card.addEventListener('pointerenter', () => v.play().catch(() => {}));
          card.addEventListener('pointerleave', () => { v.pause(); v.currentTime = 0; });
          thumb.appendChild(v);
          const play = document.createElement('div');
          play.className = 'playIcon';
          thumb.appendChild(play);
        } else {
          const img = document.createElement('img');
          img.src = it.url; img.loading = 'lazy'; img.alt = it.title;
          thumb.appendChild(img);
        }

        const cap = document.createElement('div');
        cap.className = 'visualsCap';
        const capTitle = document.createElement('div');
        capTitle.className = 'visualsCapTitle';
        capTitle.textContent = it.title;
        cap.appendChild(capTitle);

        card.appendChild(thumb);
        card.appendChild(cap);
        card.addEventListener('click', () => openVisualViewer(it));
        vGrid.appendChild(card);
      }
    }

    loadVisualMedia().then(renderVisualMedia);
  })();

  // Table wish text (hero tabletop)
  (function initTableWish(){
    const el = $('tableWish');
    if (!el) return;

    function place(){
      const W = window.innerWidth;
      const H = window.innerHeight;
      // place near the tabletop (tuned to the hero photo composition)
      const ax = W * 0.62;
      const ay = H * 0.865;
      const r = el.getBoundingClientRect();
      const left = Math.round(ax - r.width * 0.5);
      const top = Math.round(ay - r.height * 0.5);
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }

    requestAnimationFrame(place);
    window.addEventListener('resize', () => requestAnimationFrame(place), { passive: true });

    // hero-only visibility
    const hero = document.getElementById('top');
    if (hero && ('IntersectionObserver' in window)){
      const io = new IntersectionObserver((entries) => {
        const vis = !!entries?.[0]?.isIntersecting;
        el.classList.toggle('isHidden', !vis);
        if (vis) requestAnimationFrame(place);
      }, { root: null, threshold: 0.08, rootMargin: '-10% 0px -70% 0px' });
      io.observe(hero);
    } else {
      el.classList.toggle('isHidden', false);
    }
  })();

  // Hide modules that are marked as hidden in HTML (also hide their nav links)
  (function initHiddenModules(){
    const hiddenIds = Array.from(document.querySelectorAll('section[data-hidden="true"][id]'))
      .map(s => s.id)
      .filter(Boolean);
    if (!hiddenIds.length) return;

    for (const id of hiddenIds){
      // hide any anchor that points to this section
      const links = Array.from(document.querySelectorAll(`a[href="#${CSS?.escape ? CSS.escape(id) : id}"]`));
      for (const a of links) a.style.display = 'none';
    }
  })();

  // Desktop-like dock button for digital works
  (function initDeskDock(){
    const dock = $('deskDock');
    const btn = $('deskBtn');
    const drawer = $('deskDrawer');
    const closeDesk = $('closeDesk');
    const gridEl = $('deskGrid');
    const emptyEl = $('deskEmpty');

    const viewer = $('deskViewer');
    const viewerMedia = $('deskViewerMedia');
    const viewerTitle = $('deskViewerTitle');
    const viewerMeta = $('deskViewerMeta');
    const viewerDesc = $('deskViewerDesc');
    const closeViewer = $('closeDeskViewer');

    // Things (YouTube) modal
    const thingsBtn = $('thingsBtn');
    const thingsModal = $('thingsModal');
    const thingsFrame = $('thingsFrame');
    const closeThings = $('closeThings');
    const interviewBtn = $('interviewBtn');
    const interviewModal = $('interviewModal');
    const interviewFrame = $('interviewFrame');
    const closeInterview = $('closeInterview');

    if (!dock || !btn || !drawer || !gridEl || !emptyEl) return;

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    function setDrawerOpen(open){
      drawer.hidden = !open;
      drawer.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      // Keep dock visible while drawer is open
      dock.classList.toggle('isHidden', false);
      if (open) drawer.focus?.();
    }

    function setViewerOpen(open){
      if (!viewer) return;
      viewer.classList.toggle('open', open);
      // Keep dock visible while viewer is open
      if (open) dock.classList.toggle('isHidden', false);
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

    btn.addEventListener('click', async () => {
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

    function setThingsOpen(open){
      if (!thingsModal) return;
      thingsModal.classList.toggle('open', open);
      if (thingsBtn) thingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open){
        // nocookie embed; autoplay controlled by user
        if (thingsFrame) thingsFrame.src = 'https://www.youtube-nocookie.com/embed/k7OdwS5JFZk?rel=0';
      } else {
        if (thingsFrame) thingsFrame.src = '';
      }
    }

    thingsBtn?.addEventListener('click', () => setThingsOpen(true));
    closeThings?.addEventListener('click', () => setThingsOpen(false));
    thingsModal?.addEventListener('click', (e) => { if (e.target === thingsModal) setThingsOpen(false); });

    function setInterviewOpen(open){
      if (!interviewModal) return;
      interviewModal.classList.toggle('open', open);
      if (interviewBtn) interviewBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open){
        if (interviewFrame) interviewFrame.src = 'https://www.youtube-nocookie.com/embed/X9Xfjq8_XHA?rel=0';
      } else {
        if (interviewFrame) interviewFrame.src = '';
      }
    }

    interviewBtn?.addEventListener('click', () => setInterviewOpen(true));
    closeInterview?.addEventListener('click', () => setInterviewOpen(false));
    interviewModal?.addEventListener('click', (e) => { if (e.target === interviewModal) setInterviewOpen(false); });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (viewer?.classList.contains('open')) setViewerOpen(false);
      else if (drawer.classList.contains('open')) setDrawerOpen(false);
      else if (thingsModal?.classList.contains('open')) setThingsOpen(false);
      else if (interviewModal?.classList.contains('open')) setInterviewOpen(false);
    });
  })();

  // Dynamic cursor + spotlight (desktop only)
  (function initCursor(){
    const fine = window.matchMedia?.('(pointer:fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const root = document.documentElement;
    // Only show the flame cursor on the hero (to avoid distracting reading)
    let enabled = true;
    const setEnabled = (on) => {
      enabled = !!on;
      root.classList.toggle('cursorOn', enabled);
      root.classList.toggle('cursorHover', false);
    };
    setEnabled(true);

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
      if (!enabled){
        flame.style.opacity = '0';
        raf = 0;
        return;
      }
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
      if (!enabled) return;
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

    // Enable flame only when hero is visible
    (function enableOnHero(){
      const hero = document.getElementById('top');
      if (!hero || !('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => {
        const vis = !!entries?.[0]?.isIntersecting;
        setEnabled(vis);
        if (!vis){
          flame.style.opacity = '0';
        } else {
          flame.style.opacity = '0.98';
        }
      }, { root: null, threshold: 0.08, rootMargin: '0px 0px -72% 0px' });
      io.observe(hero);
    })();

    // kickstart
    flame.style.transform = tFlame(tx, ty, 0, 1);
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

