// Web Audio API Synthesizer for Hitster Bingo

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private campfireGainNode: GainNode | null = null;
  private isCampfirePlaying: boolean = false;
  private campfireTimer: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isCampfirePlaying) {
      this.stopCampfireCrackle();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // 1. Disco Ball Spin Tick
  public playSpinTick(pitchMult = 1.0) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440 * pitchMult, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880 * pitchMult, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // Audio context error fallback
    }
  }

  // 2. Disco Ball Spin Selected Chime
  public playSpinSelected() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch {
      // Audio fallback
    }
  }

  // 3. Timer Countdown Tick (Normal & Urgency)
  public playTimerTick(isUrgent = false) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isUrgent ? 880 : 440, this.ctx.currentTime);

      gain.gain.setValueAtTime(isUrgent ? 0.25 : 0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // Audio fallback
    }
  }

  // 4. Timer Expired Buzzer / Red Light Alarm
  public playTimerAlarm() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    } catch {
      // Audio fallback
    }
  }

  // 5. Tile Mark Pop
  public playTilePop(marked: boolean) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(marked ? 300 : 500, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(marked ? 600 : 250, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // Audio fallback
    }
  }

  // 6. BINGO Fanfare Victory
  public playBingoVictory() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const arpeggio = [
        { note: 523.25, time: 0 },    // C5
        { note: 659.25, time: 0.12 }, // E5
        { note: 783.99, time: 0.24 }, // G5
        { note: 1046.5, time: 0.36 }, // C6
        { note: 1318.5, time: 0.5 },  // E6
        { note: 1567.9, time: 0.65 }, // G6
      ];

      arpeggio.forEach(({ note, time }) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, this.ctx.currentTime + time);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + time + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + time);
        osc.stop(this.ctx.currentTime + time + 0.3);
      });
    } catch {
      // Audio fallback
    }
  }

  // 7. Ambient Campfire Crackle Synth (Pink Noise + Random Pop Trigger)
  public toggleCampfireCrackle(): boolean {
    if (this.isCampfirePlaying) {
      this.stopCampfireCrackle();
      return false;
    } else {
      this.startCampfireCrackle();
      return true;
    }
  }

  public getIsCampfirePlaying(): boolean {
    return this.isCampfirePlaying;
  }

  private startCampfireCrackle() {
    try {
      this.initContext();
      if (!this.ctx) return;

      this.isCampfirePlaying = true;
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.015; // Low volume background rumble
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.campfireGainNode = this.ctx.createGain();
      this.campfireGainNode.gain.setValueAtTime(0.04, this.ctx.currentTime);

      whiteNoise.connect(this.campfireGainNode);
      this.campfireGainNode.connect(this.ctx.destination);
      whiteNoise.start();

      // Random Crackle Pops
      const triggerPop = () => {
        if (!this.isCampfirePlaying || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100 + Math.random() * 800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.02);

        const volume = 0.02 + Math.random() * 0.05;
        popGain.gain.setValueAtTime(volume, this.ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);

        osc.connect(popGain);
        popGain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.02);

        const nextPopDelay = 100 + Math.random() * 600;
        this.campfireTimer = window.setTimeout(triggerPop, nextPopDelay);
      };

      triggerPop();
    } catch {
      this.isCampfirePlaying = false;
    }
  }

  private stopCampfireCrackle() {
    this.isCampfirePlaying = false;
    if (this.campfireGainNode && this.ctx) {
      this.campfireGainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.2);
    }
    if (this.campfireTimer) {
      clearTimeout(this.campfireTimer);
      this.campfireTimer = null;
    }
  }
}

export const soundEffects = new SoundSystem();
