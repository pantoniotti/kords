// src/helpers/AudioEngine.ts
export type SoundType = "sine" | "sawtooth" | "fm-piano" | "pad";

export type AudioChord = {
    notes: string[];
    durationBeats?: number;
};

type EngineState = {
    bpm: number;
    sound: SoundType;
    loop: boolean;
};

export class AudioEngine {
    private ctx: AudioContext;
    private state: EngineState;

    private seqTimeout: number | null = null;
    private sequenceIndex = 0;
    private isPlayingSequence = false;

    // NEW → allows playSequence() to override the global loop
    private activeSequenceLoop = false;

    constructor(initialBpm = 120, initialLoop = true, initialSound: SoundType = "sine") {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.state = {
            bpm: initialBpm,
            sound: initialSound,
            loop: initialLoop
        };
    }

    setBpm(bpm: number) {
        this.state.bpm = Math.max(1, Math.round(bpm));
    }

    setSound(sound: SoundType) {
        this.state.sound = sound;
    }

    setLoop(loop: boolean) {
        this.state.loop = loop;
    }

    resumeIfNeeded() {
        if (this.ctx.state === "suspended") return this.ctx.resume();
        return Promise.resolve();
    }

    private noteToFreq(note?: string) {
        if (!note) return null;
        const A4 = 440;
        const NOTES: Record<string, number> = {
            C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6,
            G: 7, "G#": 8, A: 9, "A#": 10, B: 11
        };

        const m = note.match(/^([A-G]#?)(-?\d+)$/);
        if (!m) return null;

        const [, name, octS] = m;
        const octave = parseInt(octS, 10);
        const noteVal = NOTES[name];

        if (noteVal === undefined || Number.isNaN(octave)) return null;

        const semitones = noteVal + (octave - 4) * 12;
        return A4 * Math.pow(2, (semitones - 9) / 12);
    }

    async playNote(note: string, durationSeconds = 1) {
        await this.resumeIfNeeded();
        const freq = this.noteToFreq(note);
        if (!freq) return;

        const sound = this.state.sound;

        if (sound === "fm-piano") return this.playFmPianoOneShot(freq, durationSeconds);
        if (sound === "pad") return this.playPadOneShot(freq, durationSeconds);

        const type = sound === "sawtooth" ? "sawtooth" : "sine";
        this.playOscOneShot(freq, durationSeconds, type);
    }

    async playChord(chord: AudioChord) {
        await this.resumeIfNeeded();

        const beats = chord.durationBeats ?? 1;
        const msPerBeat = 60000 / Math.max(1, this.state.bpm);
        const seconds = Math.max(0.03, (beats * msPerBeat) / 1000);

        chord.notes.forEach((note) => this.playNote(note, seconds));
    }

    playSequence(chords: AudioChord[], startIndex = 0, loop = this.state.loop) {
        if (!chords.length) return;

        this.stopSequence();

        this.isPlayingSequence = true;
        this.sequenceIndex = Math.max(0, Math.min(startIndex, chords.length - 1));

        this.activeSequenceLoop = loop;

        const tick = () => {
            if (!this.isPlayingSequence) return;

            const current = chords[this.sequenceIndex];
            if (!current) {
                this.stopSequence();
                return;
            }

            this.playChord(current);

            const beats = current.durationBeats ?? 1;
            const msPerBeat = 60000 / Math.max(1, this.state.bpm);
            const delay = Math.max(20, beats * msPerBeat);

            this.sequenceIndex++;

            if (this.sequenceIndex >= chords.length) {
                if (this.activeSequenceLoop) {
                    this.sequenceIndex = 0;
                } else {
                    this.stopSequence();
                    return;
                }
            }

            this.seqTimeout = window.setTimeout(tick, delay);
        };

        tick();
    }

    stopSequence() {
        this.isPlayingSequence = false;
        if (this.seqTimeout != null) {
            window.clearTimeout(this.seqTimeout);
            this.seqTimeout = null;
        }
    }

    // -----------------------------------------------------
    // SYNTH ENGINES
    // -----------------------------------------------------

    private playOscOneShot(freq: number, durationSeconds: number, type: OscillatorType) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            this.ctx.currentTime + Math.max(0.05, durationSeconds)
        );

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + Math.max(0.05, durationSeconds));
    }

    private playPadOneShot(freq: number, durationSeconds: number) {
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        o1.type = "sine";
        o2.type = "sine";
        o1.frequency.value = freq;
        o2.frequency.value = freq * 1.005;

        g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationSeconds);

        o1.connect(g);
        o2.connect(g);
        g.connect(this.ctx.destination);

        o1.start();
        o2.start();
        o1.stop(this.ctx.currentTime + durationSeconds + 0.02);
        o2.stop(this.ctx.currentTime + durationSeconds + 0.02);
    }

    private playFmPianoOneShot(freq: number, durationSeconds: number) {
        const carrier = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const outGain = this.ctx.createGain();

        carrier.type = "sine";
        mod.type = "sine";
        carrier.frequency.value = freq;
        mod.frequency.value = freq * 2.0;
        modGain.gain.value = freq * 1.2;

        outGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        outGain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 0.005);
        outGain.gain.exponentialRampToValueAtTime(
            0.0001,
            this.ctx.currentTime + durationSeconds
        );

        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(outGain);
        outGain.connect(this.ctx.destination);

        mod.start();
        carrier.start();
        mod.stop(this.ctx.currentTime + durationSeconds + 0.02);
        carrier.stop(this.ctx.currentTime + durationSeconds + 0.02);
    }
}
