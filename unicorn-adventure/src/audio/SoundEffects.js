const EFFECTS = {
  lakeStart: [
    { type: 'sine', from: 440, to: 600, duration: 0.22, volume: 0.06 },
    { type: 'sine', from: 660, to: 880, duration: 0.28, volume: 0.05, delay: 0.15 },
    { type: 'noise', from: 1200, to: 400, duration: 0.2, volume: 0.045 },
  ],
  lakePaddle: [
    { type: 'noise', from: 1300, to: 450, duration: 0.18, volume: 0.055 },
    { type: 'sine', from: 350, to: 190, duration: 0.14, volume: 0.035 },
  ],
  lakeFish: [
    { type: 'noise', from: 2400, to: 650, duration: 0.16, volume: 0.07 },
    { type: 'sine', from: 700, to: 1050, duration: 0.12, volume: 0.055 },
  ],
  lakeMonster: [
    { type: 'triangle', from: 170, to: 75, duration: 0.4, volume: 0.06 },
    { type: 'noise', from: 650, to: 240, duration: 0.3, volume: 0.055 },
  ],
  lakeHit: [
    { type: 'noise', from: 1500, to: 350, duration: 0.24, volume: 0.09 },
    { type: 'triangle', from: 250, to: 90, duration: 0.2, volume: 0.07 },
  ],
  lakeWin: [
    { type: 'sine', from: 523, to: 523, duration: 0.18, volume: 0.07 },
    { type: 'sine', from: 659, to: 659, duration: 0.18, volume: 0.07, delay: 0.15 },
    { type: 'sine', from: 784, to: 1047, duration: 0.32, volume: 0.07, delay: 0.3 },
  ],
  lakeLose: [
    { type: 'triangle', from: 310, to: 220, duration: 0.25, volume: 0.06 },
    { type: 'sine', from: 220, to: 130, duration: 0.38, volume: 0.065, delay: 0.2 },
  ],
  lakeMusicLow: [{ type: 'sine', from: 392, to: 392, duration: 0.45, volume: 0.035 }],
  lakeMusicMid: [{ type: 'sine', from: 494, to: 494, duration: 0.45, volume: 0.035 }],
  lakeMusicHigh: [{ type: 'sine', from: 587, to: 587, duration: 0.45, volume: 0.035 }],
  catMeow: [{ type: 'triangle', from: 580, to: 420, duration: 0.24, volume: 0.075 },
    { type: 'sine', from: 850, to: 620, duration: 0.2, volume: 0.035 }],
  worldVolcanoLow: [{ type: 'triangle', from: 147, to: 140, duration: 0.4, volume: 0.04 }],
  worldVolcanoHigh: [{ type: 'triangle', from: 220, to: 208, duration: 0.4, volume: 0.04 }],
  worldHappyC: [{ type: 'sine', from: 523, to: 523, duration: 0.3, volume: 0.035 }],
  worldHappyE: [{ type: 'sine', from: 659, to: 659, duration: 0.3, volume: 0.035 }],
  worldHappyF: [{ type: 'sine', from: 698, to: 698, duration: 0.3, volume: 0.035 }],
  worldHappyG: [{ type: 'sine', from: 784, to: 784, duration: 0.3, volume: 0.035 }],
  worldHappyA: [{ type: 'sine', from: 880, to: 880, duration: 0.3, volume: 0.035 }],
  worldDarkLow: [
    { type: 'triangle', from: 110, to: 105, duration: 0.55, volume: 0.035 },
    { type: 'sine', from: 165, to: 160, duration: 0.55, volume: 0.02 },
  ],
  worldDarkMid: [{ type: 'triangle', from: 131, to: 123, duration: 0.55, volume: 0.04 }],
  worldDarkHigh: [{ type: 'sine', from: 156, to: 148, duration: 0.55, volume: 0.045 }],
  troll: [
    { type: 'sawtooth', from: 125, to: 58, duration: 0.48, volume: 0.055 },
    { type: 'noise', from: 600, to: 180, duration: 0.42, volume: 0.045 },
  ],
  fairy: [
    { type: 'sine', from: 1175, to: 1175, duration: 0.35, volume: 0.09 },
    { type: 'sine', from: 1568, to: 1568, duration: 0.3, volume: 0.06, delay: 0.1 },
    { type: 'sine', from: 2093, to: 2093, duration: 0.35, volume: 0.04, delay: 0.2 },
  ],
  unicorn: [0, 0.11, 0.22, 0.38, 0.49, 0.6].map((delay, index) => ({
    type: 'triangle', from: index % 3 === 0 ? 190 : 140, to: 65,
    duration: 0.09, volume: 0.1, delay,
  })),
  wings: [0, 0.13, 0.26, 0.39].map((delay) => ({
    type: 'noise', from: 2100, to: 650, duration: 0.12, volume: 0.09, delay,
  })),
  crown: [
    { type: 'sine', from: 1760, to: 1760, duration: 0.38, volume: 0.1 },
    { type: 'sine', from: 2640, to: 2640, duration: 0.23, volume: 0.04 },
  ],
  saddlePickup: [
    { type: 'triangle', from: 300, to: 210, duration: 0.1, volume: 0.07 },
    { type: 'sine', from: 740, to: 980, duration: 0.18, volume: 0.065, delay: 0.08 },
  ],
  stickerPickup: [
    { type: 'sine', from: 850, to: 1250, duration: 0.12, volume: 0.07 },
    { type: 'triangle', from: 1500, to: 1750, duration: 0.16, volume: 0.045, delay: 0.09 },
  ],
  questionCorrect: [
    { type: 'sine', from: 523, to: 523, duration: 0.16, volume: 0.075 },
    { type: 'sine', from: 784, to: 784, duration: 0.23, volume: 0.075, delay: 0.13 },
  ],
  footstep: [
    { type: 'noise', from: 500, to: 180, duration: 0.065, volume: 0.065 },
    { type: 'triangle', from: 130, to: 70, duration: 0.07, volume: 0.045 },
  ],
  accessoryAttach: [
    { type: 'sine', from: 950, to: 1300, duration: 0.15, volume: 0.075 },
    { type: 'sine', from: 1600, to: 1600, duration: 0.18, volume: 0.05, delay: 0.08 },
  ],
  npcNearby: [
    { type: 'triangle', from: 660, to: 880, duration: 0.16, volume: 0.06 },
  ],
  trollThrow: [
    { type: 'noise', from: 1400, to: 350, duration: 0.18, volume: 0.09 },
  ],
  trollRockHit: [
    { type: 'noise', from: 600, to: 100, duration: 0.2, volume: 0.12 },
    { type: 'triangle', from: 150, to: 55, duration: 0.22, volume: 0.09 },
  ],
  trollApple: [
    { type: 'sine', from: 720, to: 1100, duration: 0.17, volume: 0.09 },
    { type: 'sine', from: 1350, to: 1350, duration: 0.17, volume: 0.05, delay: 0.06 },
  ],
  trollWin: [
    { type: 'triangle', from: 523, to: 523, duration: 0.17, volume: 0.08 },
    { type: 'triangle', from: 784, to: 784, duration: 0.17, volume: 0.08, delay: 0.15 },
    { type: 'triangle', from: 1047, to: 1047, duration: 0.3, volume: 0.08, delay: 0.3 },
  ],
  trollLose: [
    { type: 'sawtooth', from: 190, to: 110, duration: 0.28, volume: 0.04 },
    { type: 'triangle', from: 220, to: 110, duration: 0.35, volume: 0.07, delay: 0.2 },
  ],
  trollMusicLow: [
    { type: 'triangle', from: 110, to: 104, duration: 0.38, volume: 0.035 },
    { type: 'sine', from: 165, to: 160, duration: 0.38, volume: 0.025 },
  ],
  trollMusicHigh: [
    { type: 'triangle', from: 147, to: 139, duration: 0.38, volume: 0.035 },
    { type: 'sine', from: 155, to: 155, duration: 0.38, volume: 0.025 },
  ],
  flightStart: [
    { type: 'triangle', from: 330, to: 660, duration: 0.25, volume: 0.06 },
    { type: 'sine', from: 880, to: 1100, duration: 0.3, volume: 0.05, delay: 0.12 },
  ],
  flightFlap: [
    { type: 'noise', from: 1600, to: 450, duration: 0.14, volume: 0.07 },
    { type: 'sine', from: 440, to: 580, duration: 0.12, volume: 0.04 },
  ],
  flightBird: [
    { type: 'sawtooth', from: 650, to: 300, duration: 0.2, volume: 0.035 },
    { type: 'triangle', from: 900, to: 500, duration: 0.15, volume: 0.045, delay: 0.06 },
  ],
  flightBirdHit: [
    { type: 'noise', from: 1000, to: 250, duration: 0.2, volume: 0.09 },
    { type: 'triangle', from: 240, to: 100, duration: 0.2, volume: 0.07 },
  ],
  flightLava: [
    { type: 'noise', from: 1000, to: 150, duration: 0.3, volume: 0.09 },
    { type: 'sawtooth', from: 210, to: 65, duration: 0.3, volume: 0.04 },
  ],
  flightWin: [
    { type: 'triangle', from: 523, to: 523, duration: 0.17, volume: 0.07 },
    { type: 'triangle', from: 659, to: 659, duration: 0.17, volume: 0.07, delay: 0.13 },
    { type: 'triangle', from: 1047, to: 1047, duration: 0.35, volume: 0.07, delay: 0.26 },
  ],
  flightLose: [
    { type: 'triangle', from: 350, to: 180, duration: 0.3, volume: 0.07 },
    { type: 'sawtooth', from: 160, to: 70, duration: 0.35, volume: 0.04, delay: 0.18 },
  ],
  flightMusicLow: [
    { type: 'triangle', from: 196, to: 196, duration: 0.32, volume: 0.035 },
    { type: 'sine', from: 392, to: 392, duration: 0.3, volume: 0.02 },
  ],
  flightMusicMid: [
    { type: 'triangle', from: 247, to: 247, duration: 0.32, volume: 0.035 },
    { type: 'sine', from: 494, to: 494, duration: 0.3, volume: 0.02 },
  ],
  flightMusicHigh: [
    { type: 'triangle', from: 294, to: 294, duration: 0.32, volume: 0.035 },
    { type: 'sine', from: 587, to: 587, duration: 0.3, volume: 0.02 },
  ],
  star: [
    { type: 'square', from: 900, to: 300, duration: 0.13, volume: 0.035 },
  ],
  mosquitoHit: [
    { type: 'sine', from: 1550, to: 1950, duration: 0.18, volume: 0.1 },
    { type: 'sine', from: 2340, to: 2340, duration: 0.2, volume: 0.04 },
  ],
  mosquitoEscape: [
    { type: 'sawtooth', from: 180, to: 65, duration: 0.22, volume: 0.045 },
    { type: 'triangle', from: 95, to: 55, duration: 0.25, volume: 0.08 },
  ],
  mosquitoStart: [
    { type: 'triangle', from: 440, to: 440, duration: 0.12, volume: 0.07 },
    { type: 'triangle', from: 660, to: 660, duration: 0.18, volume: 0.07, delay: 0.13 },
  ],
  mosquitoWin: [
    { type: 'sine', from: 660, to: 660, duration: 0.18, volume: 0.08 },
    { type: 'sine', from: 880, to: 880, duration: 0.18, volume: 0.08, delay: 0.15 },
    { type: 'sine', from: 1320, to: 1320, duration: 0.35, volume: 0.08, delay: 0.3 },
  ],
  mosquitoLose: [
    { type: 'triangle', from: 330, to: 280, duration: 0.22, volume: 0.07 },
    { type: 'triangle', from: 250, to: 160, duration: 0.35, volume: 0.07, delay: 0.2 },
  ],
};

export class SoundEffects {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.context = soundManager.context;
    if (!this.context) {
      console.warn('Lydeffekter kræver Web Audio og er ikke tilgængelige i denne browser.');
    }
  }

  play(name) {
    const notes = EFFECTS[name];
    if (!notes) {
      throw new Error(`Ukendt lydeffekt: "${name}".`);
    }
    if (!this.context || this.context.state !== 'running' || this.soundManager.locked) {
      return;
    }
    for (const note of notes) {
      this.playNote(note);
    }
  }

  startMosquitoBuzz() {
    const context = this.context;
    if (!context || context.state === 'closed') {
      return null;
    }

    const buzz = context.createOscillator();
    const wobble = context.createOscillator();
    const modulation = context.createGain();
    const volume = context.createGain();
    const now = context.currentTime;
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(540, now);
    wobble.frequency.setValueAtTime(9, now);
    modulation.gain.setValueAtTime(65, now);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.025, now + 0.05);
    wobble.connect(modulation);
    modulation.connect(buzz.frequency);
    buzz.connect(volume);
    volume.connect(this.soundManager.destination);
    buzz.start(now);
    wobble.start(now);
    return {
      stop() {
        const time = context.currentTime;
        const end = context.state === 'running' ? time + 0.03 : time;
        volume.gain.cancelScheduledValues(time);
        volume.gain.setValueAtTime(volume.gain.value, time);
        if (end > time) {
          volume.gain.linearRampToValueAtTime(0, end);
        }
        buzz.onended = () => {
          buzz.disconnect();
          wobble.disconnect();
          modulation.disconnect();
          volume.disconnect();
        };
        buzz.stop(end);
        wobble.stop(end);
      },
    };
  }

  playNote({ type, from, to, duration, volume, delay = 0 }) {
    const context = this.context;
    const start = context.currentTime + delay;
    const end = start + duration;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(this.soundManager.destination);

    let source;
    if (type === 'noise') {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.random() * 2 - 1;
      }
      source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(to, end);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source = context.createOscillator();
      source.type = type;
      source.frequency.setValueAtTime(from, start);
      source.frequency.exponentialRampToValueAtTime(to, end);
      source.connect(gain);
    }
    source.start(start);
    source.stop(end);
  }
}
