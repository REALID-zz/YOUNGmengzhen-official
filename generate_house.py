import wave, struct, math, random, os

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), 'assets', 'music')

def sin(f, t, p=0): return math.sin(2*math.pi*f*t + p)
def noise(): return random.uniform(-1, 1)
def clamp(v): return max(-1.0, min(1.0, v))
def tanh_sat(x, drive=2.5): return math.tanh(x * drive)

def env_exp(t, attack, decay, sustain_t=0, release=0.01):
    if t < attack: return t / attack
    t2 = t - attack
    if t2 < sustain_t: return math.exp(-t2 * 3)
    t3 = t2 - sustain_t
    return math.exp(-(t2) * decay)

def make_kick(sr=SR, duration=0.45):
    n = int(sr * duration)
    samples = []
    for i in range(n):
        t = i / sr
        freq = 160 * math.exp(-t * 28) + 32
        body = sin(freq, t) * 0.95
        body = tanh_sat(body, 3.0)
        sub = sin(38, t) * 0.4 * math.exp(-t * 6)
        click = noise() * 0.35 * math.exp(-t * 300) if t < 0.008 else 0
        amp = 1.0 if t < 0.005 else math.exp(-(t - 0.005) * 7.5)
        samples.append(clamp((body + sub + click) * amp))
    return samples

def make_clap(sr=SR, duration=0.15):
    n = int(sr * duration)
    samples = []
    for i in range(n):
        t = i / sr
        nz = 0
        for burst in range(4):
            bt = burst * 0.004
            if t >= bt:
                nz += noise() * 0.6 * math.exp(-(t - bt) * 45)
        amp = 0.7 * math.exp(-t * 22)
        s = nz * amp
        # bandpass-ish
        samples.append(clamp(s))
    # simple 1-pole lowpass
    out = [samples[0]]
    c = 0.3
    for i in range(1, len(samples)):
        out.append(out[-1] * c + samples[i] * (1 - c))
    return out

def make_hat(sr=SR, duration=0.04, open_hat=False):
    dur = 0.12 if open_hat else duration
    n = int(sr * dur)
    samples = []
    decay = 12 if open_hat else 80
    for i in range(n):
        t = i / sr
        nz = noise()
        s6 = sin(6000, t) * 0.15 + sin(8000, t) * 0.12 + sin(11000, t) * 0.08
        amp = 0.55 * math.exp(-t * decay)
        # highpass-ish: subtract lowpass
        samples.append(clamp((nz * 0.6 + s6) * amp))
    # crude highpass: subtract smoothed version
    lp = [samples[0]]
    c = 0.06
    for i in range(1, len(samples)):
        lp.append(lp[-1] * (1 - c) + samples[i] * c)
    out = [clamp((samples[i] - lp[i]) * 2.2) for i in range(len(samples))]
    return out

def make_bass_note(freq, sr=SR, duration=0.2):
    n = int(sr * duration)
    samples = []
    for i in range(n):
        t = i / sr
        saw1 = 0
        for h in range(1, 12):
            saw1 += sin(freq * h, t) * ((-1) ** h) / h
        saw1 *= 0.4
        sub = sin(freq * 0.5, t) * 0.35
        # filter sweep
        cutoff_t = 1.0 - min(1.0, t / (duration * 0.6))
        filt_mix = 0.3 + 0.7 * cutoff_t
        amp = 1.0 if t < duration * 0.7 else math.exp(-(t - duration * 0.7) * 18)
        s = (saw1 * filt_mix + sub) * amp * 0.65
        samples.append(clamp(s))
    return samples

def make_stab(freq, sr=SR, duration=0.25):
    n = int(sr * duration)
    samples = []
    for i in range(n):
        t = i / sr
        s = 0
        for note_mult in [1, 1.26, 1.5, 2.0]:
            f = freq * note_mult
            for h in range(1, 6):
                s += sin(f * h, t, h * 0.3) * ((-1)**h) / (h * 1.5)
        s *= 0.08
        cutoff_t = max(0, 1.0 - t / (duration * 0.5))
        amp_env = min(1.0, t / 0.003) * (1.0 if t < 0.05 else math.exp(-(t - 0.05) * 8))
        samples.append(clamp(s * cutoff_t * amp_env * 2.5))
    return samples

def mix_into(buf, samples, offset, gain=1.0):
    for i, s in enumerate(samples):
        idx = offset + i
        if idx < len(buf):
            buf[idx] += s * gain

def generate_track(name, bpm, kick_pattern, hat_pattern, oh_pattern, clap_pattern,
                   bass_pattern, stab_pattern, bars=8):
    steps = bars * 16
    s16 = 60.0 / bpm / 4.0
    total_samples = int(steps * s16 * SR) + SR
    buf = [0.0] * total_samples

    kick_snd = make_kick()
    clap_snd = make_clap()
    ch_snd = make_hat(open_hat=False)
    oh_snd = make_hat(open_hat=True)

    swing_amt = 0.012

    for step in range(steps):
        s = step % 16
        s32 = step % 32
        t_sec = step * s16
        swing = swing_amt * s16 if (s % 2 == 1) else 0
        offset = int((t_sec + swing) * SR)

        if kick_pattern[s]:
            mix_into(buf, kick_snd, offset, 1.0)
            # sidechain: duck the buffer slightly before
        if clap_pattern[s]:
            mix_into(buf, clap_snd, offset, 0.85)
        if hat_pattern[s]:
            mix_into(buf, ch_snd, int((t_sec + swing) * SR), 0.55)
        if oh_pattern[s]:
            mix_into(buf, oh_snd, int((t_sec + swing) * SR), 0.45)
        if bass_pattern[s]:
            bass_snd = make_bass_note(bass_pattern[s], duration=s16 * 1.8)
            mix_into(buf, bass_snd, offset, 0.7)
        if stab_pattern and stab_pattern[s32]:
            stab_snd = make_stab(stab_pattern[s32], duration=s16 * 3)
            mix_into(buf, stab_snd, offset, 0.5)

    # Sidechain pumping: duck everything when kick hits
    pump_buf = [0.0] * total_samples
    for step in range(steps):
        s = step % 16
        if kick_pattern[s]:
            offset = int(step * s16 * SR)
            pump_len = int(s16 * 2.5 * SR)
            for i in range(pump_len):
                idx = offset + i
                if idx < total_samples:
                    duck = 0.25 + 0.75 * (i / pump_len)
                    pump_buf[idx] = max(pump_buf[idx], 1.0 - duck)

    for i in range(total_samples):
        duck = 1.0 - pump_buf[i] * 0.4
        buf[i] *= duck

    # Limiter
    peak = max(abs(s) for s in buf) or 1.0
    target = 0.92
    gain = target / peak if peak > target else 1.0
    buf = [clamp(s * gain) for s in buf]

    # Soft clip
    buf = [tanh_sat(s, 1.3) for s in buf]

    # Normalize
    peak = max(abs(s) for s in buf) or 1.0
    buf = [s * 0.95 / peak for s in buf]

    # Write WAV (mono to save space, browser can handle it)
    filepath = os.path.join(OUT, f'{name}.wav')
    with wave.open(filepath, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        for s in buf:
            wf.writeframes(struct.pack('<h', int(s * 32000)))
    fsize = os.path.getsize(filepath)
    print(f'{name}.wav: {fsize/1024:.0f}KB, {len(buf)/SR:.1f}s, {bpm}bpm')

# ── Track definitions (Dom Dolla style) ──
# 16-step patterns (1 bar), bass/stab values are frequencies (0=off)

# Track 1: RHYME — classic four-on-the-floor, offbeat hats
generate_track('rhyme', 126,
    kick_pattern= [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    hat_pattern=  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    oh_pattern=   [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
    clap_pattern= [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    bass_pattern= [87.3,0,0,87.3, 0,0,0,0, 87.3,0,0,0, 0,87.3,0,0],
    stab_pattern= [0,0,0,0,0,0,349,0, 0,0,0,0,0,0,294,0,
                   0,0,0,0,0,0,349,0, 0,0,262,0,0,0,0,0],
    bars=8)

# Track 2: MOVE — busier hats, syncopated bass
generate_track('move', 124,
    kick_pattern= [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    hat_pattern=  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    oh_pattern=   [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
    clap_pattern= [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    bass_pattern= [98,0,0,0, 0,98,0,0, 110,0,0,0, 0,0,98,0],
    stab_pattern= [392,0,0,0,0,0,0,0, 349,0,0,0,0,0,0,0,
                   294,0,0,0,0,0,0,0, 349,0,0,0,0,0,0,0],
    bars=8)

# Track 3: PULSE — driving, minimal
generate_track('pulse', 128,
    kick_pattern= [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    hat_pattern=  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    oh_pattern=   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    clap_pattern= [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    bass_pattern= [110,0,110,0, 0,0,0,0, 110,0,0,110, 0,0,131,0],
    stab_pattern= [0,0,0,0,440,0,0,0, 0,0,0,0,0,0,0,0,
                   0,0,0,0,523,0,0,0, 0,0,440,0,0,0,0,0],
    bars=8)

print('Done!')
