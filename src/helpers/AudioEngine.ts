// src/helpers/AudioEngine.ts
import Soundfont from "soundfont-player";

export type SoundType = "sawtooth" | "sine" | "triangle" | "square";

export type InstrumentId =
    | "acoustic_grand_piano"
    | "electric_piano_1"
    | "electric_piano_2"
    | "string_ensemble_1"
    | "pad_1_new_age"
    | "pad_2_warm"
    | "choir_aahs";

type ActiveVoice = {
    osc: OscillatorNode;
    gain: GainNode;
};

export class AudioEngine {
    private context: AudioContext | null = null;
    private bpm: number;
    private sound: SoundType;

    private activeVoices: Map<string, ActiveVoice> = new Map();
    private sfActiveNotes: Map<string, Set<() => void>> = new Map();
    private sequenceTimeouts: number[] = [];

    private masterGain: GainNode;

    private sfInstruments: Map<InstrumentId, Soundfont.Player> = new Map();
    private sfInstrument: Soundfont.Player | null = null;
    private useSoundfont = false;
    private soundfontReady = false;
    private noteReleaseSec = 0.25;

    constructor(bpm = 120, sound: SoundType = "sawtooth") {
        this.context = new AudioContext({ latencyHint: "interactive" });
        this.bpm = bpm;
        this.sound = sound;

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 1.8;
        this.masterGain.connect(this.context.destination);
    }

    /* ---------- Config ---------- */
    setBpm(bpm: number) {
        this.bpm = bpm;
    }

    setSound(sound: SoundType) {
        this.sound = sound;
    }

    setMasterVolume(value: number) {
        this.masterGain.gain.value = value;
    }

    setReleaseTime(sec: number) {
        this.noteReleaseSec = sec;
    }

    /* ---------- Context ---------- */
    resumeContext() {
        this.ensureContext();

        if (this.context!.state === "suspended") {
            this.context!.resume().catch(console.error);
        }
    }

    private ensureContext() {
        if (!this.context || this.context.state === "closed") {
            this.context = new AudioContext({ latencyHint: "interactive" });

            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 1.8;
            this.masterGain.connect(this.context.destination);
        }
    }

    private getContext(): AudioContext {
        this.ensureContext();
        return this.context!;
    }


    /* ---------- Utils ---------- */
    private noteToFreq(note: string) {
        const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const match = note.match(/^([A-G]#?)(\d)$/);
        if (!match) return 440;
        const [, pitch, octaveStr] = match;
        const octave = parseInt(octaveStr, 10);
        const semitone = NOTES.indexOf(pitch);
        const midi = semitone + (octave + 1) * 12;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    private beatsToSeconds(beats: number) {
        return (60 / this.bpm) * beats;
    }

    private playNoteWithSoundfont(note: string, durationSec: number) {
        if (this.useSoundfont && this.sfInstrument) {
            const ctx = this.getContext();
            const stopFn = this.playSfNote(note, ctx.currentTime);
            if (durationSec) setTimeout(stopFn, durationSec * 1000);
        }
    }

    private playNoteWithWebAudio(note: string, durationSec?: number) {
        const ctx = this.getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;

        osc.type = this.sound;
        osc.frequency.value = this.noteToFreq(note);

        osc.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.8, now + 0.01);

        osc.start(now);

        if (durationSec && durationSec > 0) {
            const stopTime = now + durationSec;
            gain.gain.setTargetAtTime(0, stopTime, 0.05);
            osc.stop(stopTime + 0.1);
        } else {
            this.activeVoices.set(note, { osc, gain });
        }
    }

    private playChordWithSoundfont(chord: { notes: string[] }, now: number, durationSec?: number) {
        if (this.useSoundfont && this.sfInstrument) {
            chord.notes.forEach(note => {
                const stopFn = this.playSfNote(note, now);
                if (durationSec) setTimeout(stopFn, durationSec * 1000);
            });
            return;
        }
    }

    private playChordWithWebAudio(chord: { notes: string[]; durationBeats?: number }, now: number, durationSec?: number) {
        chord.notes.forEach(note => {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = this.sound;
            osc.frequency.value = this.noteToFreq(note);

            osc.connect(gain);
            gain.connect(this.masterGain);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.8, now + 0.01);

            osc.start(now);

            if (durationSec) {
                const stopTime = now + durationSec;
                gain.gain.setTargetAtTime(0, stopTime, 0.08);
                osc.stop(stopTime + 0.1);
            }

            this.activeVoices.set(note, { osc, gain });
        });
    }

    private playSfNote(note: string, time: number, gain = 2.5) {
        if (!this.sfInstrument || !this.context) return () => { };

        const node = this.sfInstrument.play(note, time, { gain });
        let stopped = false;

        const stopFn = () => {
            if (stopped) return;
            stopped = true;

            try {
                node.stop();
            } catch {
                // ignore — renderer already stopped
            }

            const set = this.sfActiveNotes.get(note);
            if (set) {
                set.delete(stopFn);
                if (set.size === 0) this.sfActiveNotes.delete(note);
            }
        };

        if (!this.sfActiveNotes.has(note)) {
            this.sfActiveNotes.set(note, new Set());
        }
        this.sfActiveNotes.get(note)!.add(stopFn);

        return stopFn;
    }


    /* ---------- SoundFont ---------- */
    async loadSoundfont(name: InstrumentId) {
        this.resumeContext();

        if (this.sfInstruments.has(name)) {
            this.sfInstrument = this.sfInstruments.get(name)!;
            this.useSoundfont = true;
            this.soundfontReady = true;
            return;
        }

        this.soundfontReady = false;

        const instrument = await Soundfont.instrument(this.getContext(), name, { gain: 0.9 });
        this.sfInstruments.set(name, instrument);
        this.sfInstrument = instrument;
        this.useSoundfont = true;
        this.soundfontReady = true;
    }

    /* ---------- Play Single Note ---------- */
    playNote(note: string, durationSec?: number) {
        this.resumeContext();

        // SoundFont playback
        if (this.useSoundfont && this.soundfontReady) {
            this.playNoteWithSoundfont(note, durationSec!);
            return;
        }

        // Oscillator fallback
        this.playNoteWithWebAudio(note, durationSec);
    }

    /* ---------- Play Chord ---------- */
    playChord(chord: { notes: string[]; durationBeats?: number }) {
        this.resumeContext();
        const now = this.getContext().currentTime;
        const durationSec = chord.durationBeats ? this.beatsToSeconds(chord.durationBeats) : undefined;

        if (this.useSoundfont && this.soundfontReady) {
            this.playChordWithSoundfont(chord, now, durationSec);
            return;
        }
        
        this.playChordWithWebAudio(chord, now, durationSec);
    }

    /* ---------- Sequence ---------- */
    playSequence(
        chords: { notes: string[]; durationBeats: number }[],
        startIndex = 0,
        loop = false,
        onStep?: (chord: { notes: string[] }, index: number) => void
    ) {
        this.stopSequence();

        const schedule = (index: number) => {
            const chord = chords[index];
            if (!chord) {
                if (loop) schedule(0);
                return;
            }

            this.playChord(chord);
            onStep?.(chord, index);

            const durationMs = this.beatsToSeconds(chord.durationBeats) * 1000;
            const id = window.setTimeout(() => schedule(index + 1), durationMs);
            this.sequenceTimeouts.push(id);
        };

        schedule(startIndex);
    }

    stopNote(note: string) {
        const stopSet = this.sfActiveNotes.get(note);
        if (stopSet && stopSet.size > 0) {
            stopSet.forEach(fn => setTimeout(fn, this.noteReleaseSec * 1000));
            this.sfActiveNotes.delete(note);
            return;
        }

        const voice = this.activeVoices.get(note);
        if (!voice) return;

        const now = this.getContext().currentTime;
        voice.gain.gain.setTargetAtTime(0, now, this.noteReleaseSec);
        voice.osc.stop(now + this.noteReleaseSec + 0.05);
        this.activeVoices.delete(note);
    }

    stopAllNotes() {
        const now = this.getContext().currentTime;

        this.activeVoices.forEach(({ osc, gain }) => {
            try {
                gain.gain.setTargetAtTime(0, now, 0.05);
                osc.stop(now + 0.1);
            } catch { }
        });
        this.activeVoices.clear();

        this.sfActiveNotes.forEach(set => set.forEach(fn => fn()));
        this.sfActiveNotes.clear();
    }

    stopSequence() {
        this.sequenceTimeouts.forEach(clearTimeout);
        this.sequenceTimeouts = [];
        this.stopAllNotes();
    }

    panic() {
        this.stopSequence();
        this.stopAllNotes();
    }
}
