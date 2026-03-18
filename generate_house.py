"""Generate club-quality tech house loops (Dom Dolla / Rhyme Dust style)"""
import wave, struct, math, random, os, array

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'music')
os.makedirs(OUT, exist_ok=True)

TWO_PI = 2 * math.pi

def saw(phase):
    p = phase % TWO_PI
    return 2.0 * (p / TWO_PI) - 1.0

def sqr(phase):
    return 1.0 if (phase % TWO_PI) < math.pi else -1.0

def tri(phase):
    p = phase % TWO_PI
    if p < math.pi: return 2.0 * p / math.pi - 1.0
    return 3.0 - 2.0 * p / math.pi

def noise():
    return random.uniform(-1, 1)

def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))

def soft_clip(x, drive=2.0):
    return math.tanh(x * drive) / math.tanh(drive)

def lerp(a, b, t):
    return a + (b - a) * t

# One-pole filter state
class LP1:
    def __init__(self, cutoff, sr=SR):
        self.set_freq(cutoff, sr)
        self.y = 0.0
    def set_freq(self, cutoff, sr=SR):
        w = TWO_PI * min(cutoff, sr * 0.49) / sr
        self.a = w / (1.0 + w)
    def process(self, x):
        self.y += self.a * (x - self.y)
        return self.y

class HP1:
    def __init__(self, cutoff, sr=SR):
        self.lp = LP1(cutoff, sr)
    def process(self, x):
        return x - self.lp.process(x)

class SVF:
    """State variable filter (LP/HP/BP)"""
    def __init__(self, cutoff, q=1.0, sr=SR):
        self.sr = sr
        self.set(cutoff, q)
        self.ic1eq = 0.0
        self.ic2eq = 0.0
    def set(self, cutoff, q=None):
        g = math.tan(math.pi * min(cutoff, self.sr*0.49) / self.sr)
        if q is not None: self.k = 1.0 / max(0.5, q)
        else: self.k = getattr(self, 'k', 1.0)
        self.a1 = 1.0 / (1.0 + g * (g + self.k))
        self.a2 = g * self.a1
        self.a3 = g * self.a2
    def process(self, x):
        v3 = x - self.ic2eq
        v1 = self.a1 * self.ic1eq + self.a2 * v3
        v2 = self.ic2eq + self.a2 * self.ic1eq + self.a3 * v3
        self.ic1eq = 2*v1 - self.ic1eq
        self.ic2eq = 2*v2 - self.ic2eq
        return v2  # lowpass


def make_kick(sr=SR):
    """Club kick: massive sub, punchy transient, long tail"""
    dur = 0.5
    n = int(sr * dur)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / sr
        # Pitch: fast sweep 200→40Hz in 60ms, then slow settle to 35Hz
        if t < 0.005:
            freq = 250 + (200 - 250) * (t / 0.005)
        elif t < 0.06:
            p = (t - 0.005) / 0.055
            freq = 200 * math.exp(-p * 3.0) + 38
        else:
            freq = 38 + 4 * math.exp(-(t - 0.06) * 8)
        phase += TWO_PI * freq / sr
        # Body: sine with subtle 2nd harmonic
        body = math.sin(phase) * 0.85 + math.sin(phase * 2.02) * 0.12
        body = soft_clip(body, 2.8)
        # Sub layer (pure sine)
        sub = math.sin(TWO_PI * 36 * t) * 0.3 * max(0, 1.0 - t * 3.5)
        # Click transient
        click = 0
        if t < 0.004:
            click = noise() * 0.6 * (1.0 - t / 0.004)
            click += math.sin(TWO_PI * 3500 * t) * 0.3 * (1.0 - t / 0.004)
        # Amplitude envelope
        if t < 0.001:
            amp = t / 0.001
        elif t < 0.008:
            amp = 1.0
        else:
            amp = math.exp(-(t - 0.008) * 6.8)
        out[i] = clamp((body + sub + click) * amp * 1.1)
    return out

def make_clap(sr=SR):
    """Layered clap with spread and body"""
    dur = 0.22
    n = int(sr * dur)
    out = [0.0] * n
    bp = SVF(2200, 1.5, sr)
    for i in range(n):
        t = i / sr
        nz = 0
        # 4 micro-bursts (hand clap simulation)
        for b in range(4):
            bt = b * 0.003
            if t >= bt and t < bt + 0.04:
                dt = t - bt
                nz += noise() * 0.45 * math.exp(-dt * 55)
        # Main body
        nz += noise() * 0.55 * math.exp(-t * 18)
        s = bp.process(nz)
        out[i] = clamp(s * 0.9)
    return out

def make_hat(open_hat=False, sr=SR):
    """Metallic hi-hat with ring"""
    dur = 0.15 if open_hat else 0.045
    n = int(sr * dur)
    out = [0.0] * n
    hp = HP1(7000, sr)
    decay = 8 if open_hat else 60
    freqs = [6138, 8243, 10450, 12890, 14580]
    phases = [random.uniform(0, TWO_PI) for _ in freqs]
    for i in range(n):
        t = i / sr
        # Metallic partials
        metal = 0
        for j, f in enumerate(freqs):
            phases[j] += TWO_PI * f / sr
            metal += math.sin(phases[j]) * (0.18 / (j + 1))
        nz = noise() * 0.35
        s = metal + nz
        s = hp.process(s)
        amp = math.exp(-t * decay)
        if not open_hat and t < 0.002:
            amp *= t / 0.002
        out[i] = clamp(s * amp * 1.6)
    return out

def make_perc(sr=SR):
    """Rimshot / percussion"""
    dur = 0.06
    n = int(sr * dur)
    out = [0.0] * n
    for i in range(n):
        t = i / sr
        body = math.sin(TWO_PI * 820 * t) * 0.4 * math.exp(-t * 80)
        click = noise() * 0.3 * math.exp(-t * 200)
        ring = math.sin(TWO_PI * 1640 * t) * 0.15 * math.exp(-t * 60)
        out[i] = clamp((body + click + ring) * 1.2)
    return out

def make_bass(freq, dur, sr=SR):
    """Deep sub bass with grit"""
    n = int(sr * dur)
    out = [0.0] * n
    filt = SVF(800, 4.0, sr)
    ph1 = 0.0
    ph2 = 0.0
    for i in range(n):
        t = i / sr
        ph1 += TWO_PI * freq / sr
        ph2 += TWO_PI * (freq * 0.999) / sr
        # Saw + sub sine
        s1 = saw(ph1) * 0.3
        s2 = saw(ph2) * 0.25
        sub = math.sin(TWO_PI * freq * 0.5 * t) * 0.45
        mix = s1 + s2 + sub
        # Filter sweep down
        cutoff = 200 + 900 * max(0, 1.0 - t / (dur * 0.5))
        filt.set(cutoff)
        s = filt.process(mix)
        # Amp envelope
        if t < 0.005: amp = t / 0.005
        elif t > dur * 0.75: amp = max(0, 1.0 - (t - dur * 0.75) / (dur * 0.25))
        else: amp = 1.0
        out[i] = clamp(s * amp * 0.85)
    return out

def make_stab(freq, dur, sr=SR):
    """House chord stab"""
    n = int(sr * dur)
    out = [0.0] * n
    filt = SVF(2400, 2.0, sr)
    intervals = [1.0, 1.26, 1.5, 2.0]
    phases = [[0.0, 0.0] for _ in intervals]
    for i in range(n):
        t = i / sr
        s = 0
        for j, mult in enumerate(intervals):
            f = freq * mult
            phases[j][0] += TWO_PI * f / sr
            phases[j][1] += TWO_PI * (f * 1.006) / sr
            s += saw(phases[j][0]) * 0.12
            s += saw(phases[j][1]) * 0.10
        cutoff = 500 + 2500 * max(0, 1.0 - t / (dur * 0.4))
        filt.set(cutoff)
        s = filt.process(s)
        # Amp
        if t < 0.004: amp = t / 0.004
        elif t < 0.04: amp = 1.0
        else: amp = math.exp(-(t - 0.04) * 6)
        out[i] = clamp(s * amp * 1.5)
    return out


def mix_at(buf_l, buf_r, samples, offset, gain_l=1.0, gain_r=1.0):
    for i, s in enumerate(samples):
        idx = offset + i
        if 0 <= idx < len(buf_l):
            buf_l[idx] += s * gain_l
            buf_r[idx] += s * gain_r


def generate_track(name, bpm, patterns, bars=8):
    steps_per_bar = 16
    total_steps = bars * steps_per_bar
    s16 = 60.0 / bpm / 4.0
    total_samples = int(total_steps * s16 * SR) + SR
    buf_l = [0.0] * total_samples
    buf_r = [0.0] * total_samples

    # Pre-render sounds
    kick_snd = make_kick()
    clap_snd = make_clap()
    ch_snd = make_hat(False)
    oh_snd = make_hat(True)
    perc_snd = make_perc()

    swing = 0.02  # swing amount

    kP = patterns['kick']
    cP = patterns['clap']
    hP = patterns['hat']
    oP = patterns['oh']
    pP = patterns.get('perc', [0]*16)
    bP = patterns['bass']
    sP = patterns.get('stab', [0]*32)

    for step in range(total_steps):
        s = step % 16
        s32 = step % 32
        t_sec = step * s16
        sw = swing * s16 if (s % 2 == 1) else 0
        offset = int((t_sec + sw) * SR)

        if kP[s]:
            mix_at(buf_l, buf_r, kick_snd, offset, 1.0, 1.0)
        if cP[s]:
            mix_at(buf_l, buf_r, clap_snd, offset, 0.85, 0.85)
        if hP[s]:
            mix_at(buf_l, buf_r, ch_snd, offset, 0.45, 0.65)  # slightly right
        if oP[s]:
            mix_at(buf_l, buf_r, oh_snd, offset, 0.55, 0.45)  # slightly left
        if pP[s]:
            mix_at(buf_l, buf_r, perc_snd, offset, 0.55, 0.55)
        if bP[s]:
            bass_snd = make_bass(bP[s], s16 * 1.8)
            mix_at(buf_l, buf_r, bass_snd, offset, 0.75, 0.75)
        if sP[s32]:
            stab_snd = make_stab(sP[s32], s16 * 4)
            mix_at(buf_l, buf_r, stab_snd, offset, 0.5, 0.5)

    # Sidechain pumping
    for step in range(total_steps):
        s = step % 16
        if kP[s]:
            offset = int(step * s16 * SR)
            pump_len = int(s16 * 3 * SR)
            for i in range(pump_len):
                idx = offset + i
                if 0 <= idx < total_samples:
                    t = i / pump_len
                    # Fast attack, slow release ducking curve
                    duck = 0.15 + 0.85 * (t ** 1.5)
                    # Only duck non-kick content (approximate by scaling entire mix less at kick points)
                    # The kick itself adds volume back, so this creates the pump feel
                    buf_l[idx] *= duck
                    buf_r[idx] *= duck

    # Re-add kick at full volume (the sidechain ducked it too)
    for step in range(total_steps):
        s = step % 16
        if kP[s]:
            offset = int(step * s16 * SR)
            for i, ks in enumerate(kick_snd):
                idx = offset + i
                if 0 <= idx < total_samples:
                    t = i / len(kick_snd)
                    restore = 1.0 - (0.15 + 0.85 * (t ** 1.5))
                    buf_l[idx] += ks * restore * 0.6
                    buf_r[idx] += ks * restore * 0.6

    # Soft clip + normalize
    for ch in [buf_l, buf_r]:
        for i in range(len(ch)):
            ch[i] = soft_clip(ch[i], 1.8)
    peak = max(max(abs(s) for s in buf_l), max(abs(s) for s in buf_r)) or 1.0
    gain = 0.95 / peak
    for i in range(total_samples):
        buf_l[i] *= gain
        buf_r[i] *= gain

    # Write stereo WAV
    filepath = os.path.join(OUT, f'{name}.wav')
    with wave.open(filepath, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        raw = array.array('h')
        for i in range(total_samples):
            raw.append(int(clamp(buf_l[i]) * 32000))
            raw.append(int(clamp(buf_r[i]) * 32000))
        wf.writeframes(raw.tobytes())
    fsize = os.path.getsize(filepath)
    print(f'{name}.wav: {fsize/1024:.0f}KB, {total_samples/SR:.1f}s, {bpm}bpm, stereo')


# ── TRACK 1: RHYME (126 BPM) — Dom Dolla groove ──
generate_track('rhyme', 126, {
    'kick':  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    'clap':  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    'hat':   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    'oh':    [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
    'perc':  [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0],
    'bass':  [87,0,0,87, 0,0,0,0, 87,0,0,0, 0,87,0,0],
    'stab':  [0,0,0,0,0,0,349,0, 0,0,0,0,0,0,294,0,
              0,0,0,0,0,0,349,0, 0,0,262,0,0,0,0,0],
}, bars=8)

# ── TRACK 2: MOVE (124 BPM) — deeper, moodier ──
generate_track('move', 124, {
    'kick':  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    'clap':  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    'hat':   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    'oh':    [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
    'perc':  [0,0,0,0, 0,0,0,0, 0,1,0,0, 0,0,0,0],
    'bass':  [98,0,0,0, 0,98,0,0, 110,0,0,0, 0,0,98,0],
    'stab':  [392,0,0,0,0,0,0,0, 349,0,0,0,0,0,0,0,
              294,0,0,0,0,0,0,0, 349,0,0,0,0,0,0,0],
}, bars=8)

# ── TRACK 3: PULSE (128 BPM) — driving, energetic ──
generate_track('pulse', 128, {
    'kick':  [1,0,0,0, 1,0,0,0, 1,0,0,1, 1,0,0,0],
    'clap':  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    'hat':   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    'oh':    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    'perc':  [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
    'bass':  [110,0,110,0, 0,0,0,0, 110,0,0,110, 0,0,131,0],
    'stab':  [0,0,0,0,440,0,0,0, 0,0,0,0,0,0,0,0,
              0,0,0,0,523,0,0,0, 0,0,440,0,0,0,0,0],
}, bars=8)

print('All tracks generated!')
