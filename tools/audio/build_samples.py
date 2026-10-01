"""
Builds the instrument sample banks in public/audio/ from VS Chamber Orchestra: Community
Edition (CC0, Versilian Studios - https://github.com/sgossner/VSCO-2-CE).

For every instrument a handful of notes is picked, trimmed, given a short fade, loudness-
matched, mixed to mono and packed into one MP3 with a JSON map of where each note starts.
Pitches come from the file names, checked against a pitch detector (the library is not
consistent about which octave is called 4).

usage: python3 tools/audio/build_samples.py <path to a VSCO-2-CE checkout>
"""
import json, os, re, subprocess, sys
import numpy as np, soundfile as sf
from imageio_ffmpeg import get_ffmpeg_exe

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "audio")
SR = 32000  # plenty for orchestral samples; keeps the download small
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

def midi_of(name):
    m = re.search(r"(?<![A-Za-z])([A-G])(#?)(-?\d)(?=[_.])", name)
    return 12 * (int(m.group(3)) + 1) + NOTE[m.group(1)] + (1 if m.group(2) else 0)

def detect(x):
    """Fundamental by autocorrelation on a steady slice (MIDI, float)."""
    seg = x[int(0.15 * SR): int(0.65 * SR)]
    if len(seg) < 4000: seg = x[: int(0.5 * SR)]
    seg = seg - seg.mean()
    n = len(seg)
    f = np.fft.rfft(seg, 2 * n)
    ac = np.fft.irfft(f * np.conj(f))[:n]
    lo, hi = int(SR / 2200), int(SR / 25)
    lag = lo + int(np.argmax(ac[lo:hi]))
    # prefer the shortest lag that is nearly as strong (avoids octave-down errors)
    for div in (4, 3, 2):
        l2 = lag // div
        if l2 >= lo and ac[l2] > 0.85 * ac[lag]: lag = l2; break
    return 69 + 12 * np.log2(SR / lag / 440)

def load(path):
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        t = np.arange(0, len(x) * SR / sr) * sr / SR
        x = np.interp(t, np.arange(len(x)), x)
    return x.astype(np.float32)

def trim(x, max_len, fade):
    thr = np.max(np.abs(x)) * 10 ** (-40 / 20)
    i = int(np.argmax(np.abs(x) > thr))
    x = x[max(0, i - int(0.004 * SR)):]
    x = x[: int(max_len * SR)].copy()
    nf = min(len(x), int(fade * SR))
    x[-nf:] *= np.linspace(1, 0, nf) ** 2
    return x

def loudness(x):
    a = x[: int(0.8 * SR)]
    return float(np.sqrt(np.mean(a ** 2)) + 1e-9)

BANKS = {
  # name: (folder, filename regex, octave fix, max seconds, fade seconds, which notes)
  "piano":   ("Keys/Upright Piano", r"Player_dyn2_rr1_0(0[0-9]|[1-3][0-9]|4[0-4])\.wav", None, 3.0, 1.0, (33, 97)),
  "harp":    ("Strings/Harp", r"KSHarp_.*\.wav", 0, 2.6, 1.0, (36, 96)),
  "violins": ("Strings/Violin Section/susVib", r"_v1\.wav", None, 3.6, 0.5, None),
  "violas":  ("Strings/Viola Section/susvib", r"_v1_1\.wav", None, 3.6, 0.5, None),
  "cellos":  ("Strings/Cello Section/susvib", r"_v1_1\.wav", None, 3.6, 0.5, None),
  "basses":  ("Strings/Solo Contrabass/SusVib", r"_v3_rr1\.wav", None, 3.4, 0.5, None),
  "spic":    ("Strings/Violin Section/Spic", r"_v2_rr1\.wav", None, 0.7, 0.25, None),
  "cellospic": ("Strings/Cello Section/spic", r"_v2_RR1\.wav", None, 0.7, 0.25, None),
  "pizz":    ("Strings/Violin Section/Pizz", r"_v2_rr1\.wav", None, 1.0, 0.4, None),
  "solovln": ("Strings/Solo Violin/Arco Vib", r"_p\.wav", 0, 3.2, 0.5, (55, 91)),
  "flute":   ("Woodwinds/Flute/susvib", r"_v1_1\.wav", None, 3.0, 0.4, None),
  "oboe":    ("Woodwinds/Oboe/Vib", r"_v3_Main\.wav", None, 3.0, 0.4, None),
  "clarinet": ("Woodwinds/Clarinet/susLong", r"_v2_rr1_sum\.wav", None, 3.0, 0.4, None),
  "bassoon": ("Woodwinds/Bassoon/sus", r"_v2_1\.wav", None, 3.0, 0.4, None),
  "horn":    ("Brass/F Horn/sus", r"_v[12]_1\.wav", None, 3.0, 0.4, None),
  "trumpet": ("Brass/Trumpet/sus", r"_v3_rr1\.wav", None, 2.6, 0.4, None),
  "trombone": ("Brass/Tenor Trombone/sus", r"_v2_1\.wav", None, 2.8, 0.4, None),
  "glock":   ("Percussion/Glock", r"\.wav", None, 2.4, 1.0, None),
  "marimba": ("Percussion/Marimba", r"\.wav", None, 1.4, 0.5, None),
}

# pitched percussion: the pitch comes from the detector (timpani) or the file name (bells)
PITCHED = {
  "timp":    ("Percussion/Timpani", r"_Hit_v3_rr1_Sum\.wav", 2.6, 1.2),
  "bells":   ("Percussion", r"TB_hit_.*\.wav", 3.2, 1.2),
}

# measured from the spectra (90, 122, 142, 169, 191 Hz)
TIMP_PITCH = {1: 41.5, 2: 46.8, 3: 49.4, 4: 52.4, 5: 54.6}

# one-shots, by name: (file, max seconds, fade seconds)
HITS = {
  "kick":      ("Percussion/BDrumNewhit_v5_rr1_Sum.wav", 1.6, 0.6),
  "kick_soft": ("Percussion/BDrumNewhit_v2_rr1_Sum.wav", 1.4, 0.6),
  "snare":     ("Percussion/Snare2-HitSN_v7_rr1_Sum.wav", 0.7, 0.3),
  "snare_soft": ("Percussion/Snare2-HitSN_v3_rr1_Sum.wav", 0.6, 0.3),
  "snare_roll": ("Percussion/Snare2-rollSN_v3_rr1_Sum.wav", 2.4, 0.5),
  "crash":     ("Percussion/cymbal-crash1_ff_rr1.wav", 3.0, 1.4),
  "crash_soft": ("Percussion/cymbal-crash1_mp_rr1.wav", 2.6, 1.2),
  "swell":     ("Percussion/susCymb1-cresc-Short_v1.wav", 4.0, 0.6),
  "cymbal":    ("Percussion/susCymb1-hit_mp_rr1.wav", 2.6, 1.2),
  "gong":      ("Percussion/gongHit_f.wav", 4.5, 2.0),
  "tri":       ("Percussion/Triangle3-Hit_v2_rr1_Sum.wav", 2.2, 1.0),
  "tamb":      ("Percussion/Tamb1-Hit_v2_rr1_Sum.wav", 0.7, 0.3),
  "shaker":    ("Percussion/Tamb1-Shake_v1_rr1_Sum.wav", 0.6, 0.25),
  "sleigh":    ("Percussion/Sleighbells_Hit_v1_rr1_Mid.wav", 1.2, 0.5),
  "belltree":  ("Percussion/BellTree_Stroke1_v1_Sum.wav", 2.6, 1.0),
  "anvil":     ("Percussion/Anvil_Hit1_v2_Sum.wav", 1.4, 0.7),
  "claves":    ("Percussion/Claves1_Hit_v1_rr1_Sum.wav", 0.35, 0.15),
  "log_hi":    ("Percussion/LogDrumHi_MedM_v2_rr1_Sum.wav", 0.6, 0.25),
  "log_lo":    ("Percussion/LogDrumLo_MedM_v2_rr1_Sum.wav", 0.7, 0.3),
  "vibra":     ("Percussion/vibraring_v1_rr1.wav", 2.6, 1.2),
  "timp_roll": ("Percussion/Timpani/Rolls/Timpani2_Roll_v5_rr1_Sum.wav", 3.0, 0.8),
}

def pick(folder, rx):
    files = sorted(f for f in os.listdir(os.path.join(SRC, folder)) if re.search(rx, f))
    return [os.path.join(SRC, folder, f) for f in files]

def encode(x, name):
    wav = f"/tmp/fl_{name}.wav"
    sf.write(wav, x, SR, subtype="PCM_16")
    subprocess.run([get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-c:a", "libmp3lame", "-q:a", "7", os.path.join(OUT, f"{name}.mp3")], check=True)
    os.remove(wav)

def pack(name, notes, gain):
    """notes: list of (key, signal). Lays them out with gaps; returns the JSON map."""
    lead, gap = 0.25, 0.12
    parts, entries, pos = [np.zeros(int(lead * SR), np.float32)], [], lead
    for key, x in notes:
        entries.append({"k": key, "o": round(pos, 4), "d": round(len(x) / SR, 4)})
        parts += [x * gain, np.zeros(int(gap * SR), np.float32)]
        pos += len(x) / SR + gap
    sig = np.concatenate(parts)
    peak = np.max(np.abs(sig))
    if peak > 0.98: sig *= 0.98 / peak
    encode(sig, name)
    return entries

def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    for name, (folder, rx, fix, mx, fade, _) in BANKS.items():
        files = pick(folder, rx)
        notes = []
        for p in files:
            x = load(p)
            base = os.path.basename(p)
            if name == "piano": label = 21 + 2 * int(re.search(r"_(\d{3})\.wav", base).group(1))
            else: label = midi_of(base)
            got = detect(trim(x, 1.0, 0.01)) if name not in ("glock",) else None
            notes.append((label, got, trim(x, mx, fade), base))
        # one octave correction for the whole instrument, from the median disagreement
        if fix is None:
            diffs = [round((g - l) / 12) for l, g, _, _ in notes if g is not None]
            fix = int(np.median(diffs)) if diffs else 0
        # the glock is too high-pitched for the detector; same convention as the rest
        if name == "glock": fix = 1
        rng = BANKS[name][5] or (0, 127)
        out = sorted(((l + 12 * fix, x) for l, g, x, b in notes if rng[0] <= l + 12 * fix <= rng[1]), key=lambda t: t[0])
        # drop near-duplicates (keep every note at least 2 semitones apart)
        kept = []
        for k, x in out:
            if not kept or k - kept[-1][0] >= 2: kept.append((k, x))
        ref = np.median([loudness(x) for _, x in kept])
        gain = 0.12 / ref
        index[name] = pack(name, kept, gain)
        bad = [(b, l + 12 * fix, round(g, 1)) for l, g, _, b in notes if g is not None and abs(g - (l + 12 * fix)) > 1.0]
        print(f"{name:10s} fix={fix:+d} notes={[k for k, _ in kept]}" + (f"  pitch-check off: {bad[:4]}" if bad else ""))
    for name, (folder, rx, mx, fade) in PITCHED.items():
        notes = []
        for p in pick(folder, rx):
            x = load(p)
            base = os.path.basename(p)
            # timpani: the lowest strong partial (principal mode; the others sit at x1.5, x2)
            key = TIMP_PITCH[int(base[7])] if name == "timp" else midi_of(base)
            notes.append((key, trim(x, mx, fade)))
        notes.sort(key=lambda t: t[0])
        ref = np.median([loudness(x) for _, x in notes])
        index[name] = pack(name, notes, 0.12 / ref)
        print(f"{name:10s} notes={[k for k, _ in notes]}")
    hits = []
    for key, (path, mx, fade) in HITS.items():
        x = trim(load(os.path.join(SRC, path)), mx, fade)
        # each one keeps its natural level relative to a full-scale hit
        hits.append((key, x * (0.7 / max(1e-6, np.max(np.abs(x))))))
    index["perc"] = pack("perc", hits, 1.0)
    print("perc      ", [k for k, _ in hits])
    with open(os.path.join(OUT, "banks.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))

if __name__ == "__main__":
    main()
