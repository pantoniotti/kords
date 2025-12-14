// src/helpers/AudioEngine.ts
export type SoundType = "sawtooth" | "sine" | "triangle" | "square";

type ActiveVoice = {
    osc: OscillatorNode;
    gain: GainNode;
};

export class AudioEngine {
    private context: AudioContext;
    private bpm: number;
    private sound: SoundType;

    private activeVoices: Map<string, ActiveVoice> = new Map();
    private sequenceTimeouts: number[] = [];

    constructor(bpm = 120, sound: SoundType = "sawtooth") {
        this.context = new AudioContext({ latencyHint: "interactive" });
        this.bpm = bpm;
        this.sound = sound;
    }

    /* ---------- config ---------- */
    setBpm(bpm: number) { this.bpm = bpm; }
    setSound(sound: SoundType) { this.sound = sound; }

    resumeContext() {
        if (this.context.state === "suspended") {
            this.context.resume().catch(console.error);
        }
    }

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

    /* ---------- keyboard / manual notes ---------- */
    playNote(note: string, durationSec?: number) {
        this.resumeContext();

        this.stopNote(note);

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const now = this.context.currentTime;

        osc.type = this.sound;
        osc.frequency.value = this.noteToFreq(note);
        osc.connect(gain);
        gain.connect(this.context.destination);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.8, now + 0.01);

        osc.start(now);

        if (durationSec != null && durationSec > 0) {
            const stopTime = now + durationSec;
            gain.gain.setTargetAtTime(0, stopTime, 0.05);
            osc.stop(stopTime + 0.1);
        } else {
            // sustained note
            this.activeVoices.set(note, { osc, gain });
        }
    }

    /* ---------- chords (preview / sequence) ---------- */
    playChord(chord: { notes: string[]; durationBeats?: number }) {
        this.resumeContext();

        const now = this.context.currentTime;
        const durationSec = chord.durationBeats ? this.beatsToSeconds(chord.durationBeats) : 0;

        chord.notes.forEach(note => {
            this.stopNote(note);

            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = this.sound;
            osc.frequency.value = this.noteToFreq(note);

            osc.connect(gain);
            gain.connect(this.context.destination);

            // attack
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.8, now + 0.01);

            osc.start(now);

            if (durationSec > 0) {
                const stopTime = now + durationSec;
                gain.gain.setTargetAtTime(0, stopTime, 0.08);
                osc.stop(stopTime + 0.1);
            }

            this.activeVoices.set(note, { osc, gain });
        });
    }

    /* ---------- sequence ---------- */
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
        const voice = this.activeVoices.get(note);
        if (!voice) return;

        const now = this.context.currentTime;
        try {
            voice.gain.gain.setTargetAtTime(0, now, 0.05);
            voice.osc.stop(now + 0.1);
        } catch { }
        this.activeVoices.delete(note);
    }

    stopAllNotes() {
        const now = this.context.currentTime;
        this.activeVoices.forEach(({ osc, gain }) => {
            try {
                gain.gain.setTargetAtTime(0, now, 0.05);
                osc.stop(now + 0.1);
            } catch { }
        });
        this.activeVoices.clear();
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
