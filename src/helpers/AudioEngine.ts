// src/helpers/AudioEngine.ts
export type SoundType = "sawtooth" | "sine" | "triangle" | "square";

type Chord = {
    notes: string[];
    durationBeats: number;
};

export class AudioEngine {
    private context: AudioContext;
    private bpm: number;
    private sound: SoundType;
    private gainNode: GainNode;
    private activeOscillators: Map<string, OscillatorNode> = new Map();
    private sequenceTimeouts: number[] = [];

    constructor(bpm = 120, sound: SoundType = "sawtooth") {
        this.context = new AudioContext({ latencyHint: "interactive" });
        
        this.bpm = bpm;
        this.sound = sound;
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = 0.3;
        this.gainNode.connect(this.context.destination);
    }

    setBpm(bpm: number) { this.bpm = bpm; }
    setSound(sound: SoundType) { this.sound = sound; }

    private noteToFreq(note: string): number {
        const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const match = note.match(/^([A-G]#?)(\d)$/);
        if (!match) return 440;
        const [, pitch, octaveStr] = match;
        const octave = parseInt(octaveStr, 10);
        const semitone = NOTES.indexOf(pitch);
        const midi = semitone + (octave + 1) * 12;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    playNote(note: string, durationSec: number) {
        this.resumeContext(); // 🔑 ensure context is running

        this.stopNote(note);
        const osc = this.context.createOscillator();
        osc.type = this.sound;
        osc.frequency.value = this.noteToFreq(note);
        osc.connect(this.gainNode);
        osc.start();
        this.activeOscillators.set(note, osc);
        if (durationSec > 0) {
            const id = window.setTimeout(() => this.stopNote(note), durationSec * 1000);
            this.sequenceTimeouts.push(id);
        }
    }

    stopNote(note: string) {
        const osc = this.activeOscillators.get(note);
        if (osc) {
            try { osc.stop(); } catch { }
            osc.disconnect();
            this.activeOscillators.delete(note);
        }
    }

    playChord(chord: Chord) {
        this.resumeContext();
        if (this.context.state !== "running") return; // wait for user gesture
        // this.stopAllNotes();
        const seconds = (60 / this.bpm) * chord.durationBeats;
        chord.notes.forEach(n => this.playNote(n, seconds));
    }

    playSequence(
        chords: { notes: string[]; durationBeats: number }[],
        startIndex = 0,
        loop = true,
        onStep?: (chord: { notes: string[] }, index: number) => void
    ) {
        if (this.sequenceTimeouts.length) this.stopSequence();

        const schedule = (index: number) => {
            if (!chords[index]) {
                if (loop) schedule(0);
                return;
            }

            const chord = chords[index];

            this.playChord(chord);
            onStep?.(chord, index);

            const durationMs = (60 / this.bpm) * chord.durationBeats * 1000;

            const id = window.setTimeout(
                () => schedule(index + 1),
                durationMs
            );

            this.sequenceTimeouts.push(id);
        };

        schedule(startIndex);
    }

    stopSequence() {
        this.sequenceTimeouts.forEach(id => clearTimeout(id));
        this.sequenceTimeouts = [];
        this.stopAllNotes(); // 🔑

        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch { }
            osc.disconnect();
        });
        this.activeOscillators.clear();
    }

    resumeContext() {
        if (this.context.state === "suspended") {
            this.context.resume().catch(err => console.error("Failed to resume AudioContext:", err));
        }
    }

    panic() {
        this.stopSequence();
        this.stopAllNotes();
    }

    stopAllNotes() {
        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch { }
            osc.disconnect();
        });
        this.activeOscillators.clear();
    }

}
