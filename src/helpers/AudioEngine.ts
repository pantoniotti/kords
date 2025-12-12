export type SoundType = "piano" | "synth" | "organ";

export type Chord = {
    notes: string[];
    durationBeats?: number;
};

export class AudioEngine {
    private audioCtx: AudioContext;
    private currentSound: SoundType = "piano";
    private loop = true;
    private bpm = 120;
    private timeoutRef: number | null = null;

    constructor(bpm: number = 120, loop: boolean = true) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.bpm = bpm;
        this.loop = loop;
    }

    setSound(sound: SoundType) {
        this.currentSound = sound;
    }

    setBpm(bpm: number) {
        this.bpm = Math.max(1, bpm);
    }

    setLoop(loop: boolean) {
        this.loop = loop;
    }

    private getStepMs() {
        return 60000 / this.bpm;
    }

    private noteToFreq(note: string): number | null {
        // Simple A440 mapping for demo; ideally you provide your noteToFreq
        const A4 = 440;
        const noteMap: Record<string, number> = {
            "C4": -9, "C#4": -8, "D4": -7, "D#4": -6, "E4": -5, "F4": -4,
            "F#4": -3, "G4": -2, "G#4": -1, "A4": 0, "A#4": 1, "B4": 2,
        };
        if (!(note in noteMap)) return null;
        return A4 * Math.pow(2, noteMap[note] / 12);
    }

    private createOscillator(freq: number) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.frequency.value = freq;

        // Waveform based on selected sound
        switch (this.currentSound) {
            case "piano":
                osc.type = "sine";
                break;
            case "synth":
                osc.type = "sawtooth";
                break;
            case "organ":
                osc.type = "square";
                break;
        }

        // Fade out to avoid clicks
        gain.gain.setValueAtTime(1, this.audioCtx.currentTime);

        osc.connect(gain).connect(this.audioCtx.destination);

        return { osc, gain };
    }

    playChord(chord: Chord) {
        const durationMs = (chord.durationBeats ?? 1) * this.getStepMs();
        const durationSec = durationMs / 1000;

        chord.notes.forEach((note) => {
            const freq = this.noteToFreq(note);
            if (!freq) return;

            const { osc, gain } = this.createOscillator(freq);

            const stopTime = this.audioCtx.currentTime + durationSec;
            gain.gain.linearRampToValueAtTime(0, stopTime - 0.02);

            osc.start();
            osc.stop(stopTime);
        });
    }

    playSequence(chords: Chord[], startIndex = 0) {
        if (!chords.length) return;
        this.stopSequence();

        let i = startIndex;

        const scheduleNext = () => {
            if (!chords.length) return;
            if (i >= chords.length) {
                if (this.loop) i = 0;
                else return this.stopSequence();
            }

            const chord = chords[i];
            this.playChord(chord);

            const delay = Math.max(50, (chord.durationBeats ?? 1) * this.getStepMs());

            i += 1;
            this.timeoutRef = window.setTimeout(scheduleNext, delay);
        };

        scheduleNext();
    }

    stopSequence() {
        if (this.timeoutRef != null) {
            window.clearTimeout(this.timeoutRef);
            this.timeoutRef = null;
        }
    }
}
