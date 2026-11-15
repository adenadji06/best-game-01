// NEON BASTION — tiny procedural sound effects, synthesised with WebAudio.
// No audio files ship with the game; every zap and boom is made here.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, endFreq, seconds, type, gain) {
    const ctx = ensure();
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), ctx.currentTime + seconds);
      amp.gain.setValueAtTime(gain, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
      osc.connect(amp).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      // Sound is garnish; a failure here must never break the game.
    }
  }

  function noise(seconds, gain) {
    const ctx = ensure();
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const length = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      const amp = ctx.createGain();
      amp.gain.value = gain;
      source.buffer = buffer;
      source.connect(amp).connect(ctx.destination);
      source.start();
    } catch {
      // See tone(): sound must never break the game.
    }
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    shoot() {
      tone(720, 180, 0.09, 'square', 0.05);
    },
    kill() {
      noise(0.18, 0.16);
      tone(220, 50, 0.18, 'sawtooth', 0.08);
    },
    core() {
      tone(880, 1320, 0.12, 'sine', 0.09);
    },
    hit() {
      noise(0.3, 0.22);
      tone(160, 40, 0.3, 'sawtooth', 0.14);
    },
    clear() {
      tone(523, 523, 0.1, 'sine', 0.1);
      setTimeout(() => tone(659, 659, 0.1, 'sine', 0.1), 90);
      setTimeout(() => tone(784, 784, 0.16, 'sine', 0.1), 180);
    },
    boss() {
      tone(90, 45, 0.6, 'sawtooth', 0.16);
    },
  };
}
