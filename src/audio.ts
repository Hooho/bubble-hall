/** Small, offline arcade sound bank. Audio starts only after a user gesture. */
export class ArcadeAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private lastBlast = 0;
  enabled = localStorage.getItem('bubble-sound') !== 'off';

  unlock(): void {
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.28 : 0;
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('bubble-sound', this.enabled ? 'on' : 'off');
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled ? 0.28 : 0, this.context.currentTime, 0.02);
    return this.enabled;
  }

  private tone(from: number, to: number, duration: number, delay = 0, type: OscillatorType = 'sine', volume = 0.3): void {
    if (!this.context || !this.master || !this.enabled) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  play(kind: 'click' | 'place' | 'blast' | 'pickup' | 'coin' | 'growth' | 'life' | 'win' | 'lose' | 'start' | 'champion'): void {
    if (kind === 'champion') {
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((note, i) => {
        this.tone(note, note, .4, i * .2, 'triangle', .25);
        this.tone(note / 2, note / 2, .38, i * .2, 'sine', .12);
      });
    }
    if (kind === 'coin') this.tone(1400, 1900, .12, 0, 'sine', .2);
    if (kind === 'growth') this.tone(500, 1100, .18, 0, 'triangle', .24);
    if (kind === 'life') [660, 830, 990].forEach((note, i) => this.tone(note, note, .3, i * .1, 'sine', .22));
    if (kind === 'click') this.tone(700, 1050, 0.07);
    if (kind === 'place') this.tone(420, 110, 0.13, 0, 'sine', 0.5);
    if (kind === 'pickup' || kind === 'start' || kind === 'win') {
      const notes = kind === 'win' ? [523, 659, 784, 1046] : [660, 880, 1320];
      notes.forEach((note, i) => this.tone(note, note * 1.01, 0.19, i * 0.09, 'triangle'));
    }
    if (kind === 'lose') [440, 330, 220].forEach((note, i) => this.tone(note, note * 0.8, 0.22, i * 0.12, 'triangle'));
    if (kind !== 'blast' || !this.context || !this.master || !this.enabled) return;
    if (this.context.currentTime - this.lastBlast < 0.07) return;
    this.lastBlast = this.context.currentTime;
    this.tone(180, 40, 0.32, 0, 'sine', 0.8);
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.3, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 3);
    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800;
    noise.buffer = buffer;
    noise.connect(filter).connect(this.master);
    noise.start();
    noise.onended = () => { noise.disconnect(); filter.disconnect(); };
  }
}
