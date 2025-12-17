import { describe, it, expect } from "vitest";
import { AudioHelper } from "../src/helpers/AudioHelper";

// Helper to test chord → notes → MIDI
function testChord(chord: string, expectedNotes: string[], baseOctave = 3) {
    const notes = AudioHelper.chordToNotes(chord, baseOctave);
    expect(notes).toEqual(expectedNotes);

    const midi = AudioHelper.notesToMidi(notes);
    const expectedMidi = expectedNotes.map(note => AudioHelper.notesToMidi([note])[0]);
    expect(midi).toEqual(expectedMidi);
}

describe("AudioHelper", () => {
    it("voices a simple chord ascending", () => {
        const notes = AudioHelper.voiceChord(["C", "E", "G", "C"], 3);
        expect(notes).toEqual(["C3", "E3", "G3", "C4"]);
    });

    it("converts chord symbol to notes", () => {
        const notes = AudioHelper.chordToNotes("Cmin7", 3);
        expect(notes).toEqual(["C3", "Eb3", "G3", "Bb3"]);
    });

    it("converts notes to MIDI", () => {
        const midi = AudioHelper.notesToMidi(["C3", "Eb3", "G3", "Bb3"]);
        expect(midi).toEqual([48, 51, 55, 58]);
    });

    it("returns empty array for invalid chord", () => {
        const notes = AudioHelper.chordToNotes("XYZ", 3);
        expect(notes).toEqual([]);
    });

    it("handles repeated notes in chord correctly", () => {
        const notes = AudioHelper.voiceChord(["C", "C", "E"], 3);
        expect(notes).toEqual(["C3", "C4", "E4"]);
    });
});

describe("AudioHelper - chord tests", () => {
    it("voices major chord ascending", () => {
        testChord("C", ["C3", "E3", "G3"]);
    });

    it("voices minor chord ascending", () => {
        testChord("Cmin", ["C3", "Eb3", "G3"]);
    });

    it("voices diminished chord ascending", () => {
        testChord("Cdim", ["C3", "Eb3", "Gb3"]);
    });

    it("voices augmented chord ascending", () => {
        testChord("Caug", ["C3", "E3", "G#3"]);
    });

    it("voices dominant 7th chord", () => {
        testChord("C7", ["C3", "E3", "G3", "Bb3"]);
    });

    it("voices major 7th chord", () => {
        testChord("Cmaj7", ["C3", "E3", "G3", "B3"]);
    });

    it("handles repeated notes", () => {
        const notes = AudioHelper.voiceChord(["C", "C", "E"], 3);
        expect(notes).toEqual(["C3", "C4", "E4"]);
    });

    it("returns empty array for invalid chord", () => {
        const notes = AudioHelper.chordToNotes("XYZ", 3);
        expect(notes).toEqual([]);
    });

    it("voices chords starting from different octaves", () => {
        testChord("Cmin7", ["C2", "Eb2", "G2", "Bb2"], 2);
        testChord("Cmin7", ["C4", "Eb4", "G4", "Bb4"], 4);
    });

    it("ensures MIDI is ascending", () => {
        const notes = AudioHelper.chordToNotes("Cmin7", 3);
        const midi = AudioHelper.notesToMidi(notes);
        for (let i = 1; i < midi.length; i++) {
            expect(midi[i]).toBeGreaterThan(midi[i - 1]);
        }
    });

    it("handles all basic chord qualities in loop", () => {
        const chords: Record<string, string[]> = {
            C: ["C3", "E3", "G3"],
            Cmin: ["C3", "Eb3", "G3"],
            Cdim: ["C3", "Eb3", "Gb3"],
            Caug: ["C3", "E3", "G#3"],
            C7: ["C3", "E3", "G3", "Bb3"],
            Cmaj7: ["C3", "E3", "G3", "B3"],
            Cmin7: ["C3", "Eb3", "G3", "Bb3"],
            Cdim7: ["C3", "Eb3", "Gb3", "Bbb3"],
        };

        for (const [chord, expected] of Object.entries(chords)) {
            testChord(chord, expected);
        }
    });
});