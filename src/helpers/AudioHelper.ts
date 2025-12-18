// src/helpers/AudioHelpers.ts
import { Chord, Note } from "@tonaljs/tonal";

export type PitchClass = string;

export class AudioHelper {
    /**
     * Voices a list of pitch classes so that each note ascends in pitch,
     * starting from a base octave.
     */
    static voiceChord(notes: PitchClass[], baseOctave: number = 3): string[] {
        const result: string[] = [];
        let currentOctave = baseOctave;
        let lastMidi = -Infinity;

        for (const note of notes) {
            let midi = Note.midi(`${note}${currentOctave}`);

            while (midi != null && midi <= lastMidi) {
                currentOctave++;
                midi = Note.midi(`${note}${currentOctave}`);
            }

            if (midi == null) continue;

            result.push(`${note}${currentOctave}`);
            lastMidi = midi;
        }

        return result;
    }

    /**
     * Converts a chord symbol (e.g. "Cmin7") into voiced notes with octaves.
     */
    static chordToNotes(chord: string, baseOctave: number = 3): string[] {
        const parsed = Chord.get(chord);
        if (!parsed || !parsed.notes.length) return [];
        return this.voiceChord(parsed.notes, baseOctave);
    }

    /**
     * Converts voiced notes to MIDI numbers.
     */
    static notesToMidi(notes: string[]): number[] {
        return notes
            .map(Note.midi)
            .filter((n): n is number => n != null);
    }

    static normalizeSharps(notes: string[]) {
        return notes.map(this.forceSharps);
    }

    static forceSharps(note: string) {
        const n = Note.get(note);
        if (!n.pc) return note;

        // Convert flat pitch classes to enharmonic sharps
        const ENHARMONIC_MAP: Record<string, string> = {
            Db: "C#",
            Eb: "D#",
            Gb: "F#",
            Ab: "G#",
            Bb: "A#",
        };

        const pc = ENHARMONIC_MAP[n.pc] ?? n.pc;
        return pc + n.oct!;
    }

}
