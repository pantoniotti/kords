// src/KordApp.tsx
import { useEffect, useRef, useState } from "react";
import { detect as detectChord } from "@tonaljs/chord-detect";
import { Note } from "@tonaljs/tonal";

import { AudioEngine } from "../helpers/AudioEngine";
import Keyboard from "./Keyboard";
import ChordTimeline from "./ChordsTimeline";
import ChordImportExport from "./ChordImportExport";
import ChordDisplay from "./ChordDisplay";

/* ---------- constants ---------- */
const KEYS = [
	"C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1",
	"C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2",
	"C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
	"C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
	"C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
	"C6"
];

const whiteKeyWidth = 48;
const blackKeyOffsetMap: Record<string, number> = { C: 32, D: 30, F: 30, G: 30, A: 30 };
const BASE_KEYBOARD: Record<string, string> = { a: "C", w: "C#", s: "D", e: "D#", d: "E", f: "F", t: "F#", g: "G", y: "G#", h: "A", u: "A#", j: "B" };
const EXTRA_KEYBOARD: Record<string, string> = { i: "C", k: "C#", o: "D", l: "D#", p: "E" };

const CHORD_THRESHOLD = 50;
const VISIBLE_KEYS_COUNT = 37;

function sortNotesByPitch(notes: string[]) {
	return [...notes].sort((a, b) => {
		const ma = Note.midi(a), mb = Note.midi(b);
		if (ma == null || mb == null) return 0;
		return ma - mb;
	});
}

export default function KordApp() {
	const [activeNotes, setActiveNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState<string>("—");
	const [baseOctave, setBaseOctave] = useState(3);
	const [savedChords, setSavedChords] = useState<any[]>([]);
	const [loop, setLoop] = useState(false); // controls sequence looping

	const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pressedNotes = useRef<Set<string>>(new Set());
	const [playheadIndex, setPlayheadIndex] = useState<number | null>(null); // for chods playhead

	const startIndex = Math.min(Math.max(0, KEYS.findIndex(k => parseInt(k.slice(-1)) === baseOctave)), KEYS.length - VISIBLE_KEYS_COUNT);
	const visibleKeys = KEYS.slice(startIndex, startIndex + VISIBLE_KEYS_COUNT);
	const visibleWhiteKeys = visibleKeys.filter(k => !k.includes("#"));

	const blackKeyPositions: { note: string; leftPosition: number }[] = [];
	const keyBoardWith = `${visibleWhiteKeys.length * whiteKeyWidth}px`

	// Audio engine
	const audioEngineRef = useRef<AudioEngine>(new AudioEngine(120, "sine"));


	// ---------------- Chord Detection ----------------
	useEffect(() => {
		if (activeNotes.length === 0) { setChordName("—"); return; }
		const matches = detectChord(sortNotesByPitch(activeNotes));
		setChordName(matches.length ? matches[0] : "—");
	}, [activeNotes]);

	// ---------------- Keyboard Detection ----------------
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "z") { setBaseOctave(prev => Math.max(1, prev - 1)); return; }
			if (e.key === "x") { setBaseOctave(prev => Math.min(4, prev + 1)); return; }
			const note = getNoteFromKey(e.key.toLowerCase());
			if (!note) return;
			if (!pressedNotes.current.has(note)) handleIncomingNote(note);
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			const note = getNoteFromKey(e.key.toLowerCase());
			if (!note) return;
			stopNoteHold(note);
		};
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [baseOctave]);

	useEffect(() => {
		const resume = () => audioEngineRef.current.resumeContext();
		window.addEventListener("keydown", resume, { once: true });
		window.addEventListener("mousedown", resume, { once: true });
		window.addEventListener("touchstart", resume, { once: true });
		return () => {
			window.removeEventListener("keydown", resume);
			window.removeEventListener("mousedown", resume);
			window.removeEventListener("touchstart", resume);
		};
	}, []);


	// ---------------- Midi detection ----------------
	useEffect(() => {
		if (!navigator.requestMIDIAccess) return;
		navigator.requestMIDIAccess().then(midi => {
			for (let input of midi.inputs.values()) {
				input.onmidimessage = (msg) => {
					if (!msg.data) return;
					const [status, key, velocity] = msg.data;
					const note = midiNoteToName(key);
					if (!note) return;

					if (status === 144 && velocity > 0) { // note on
						if (!pressedNotes.current.has(note)) handleIncomingNote(note);
					}
					if (status === 128 || (status === 144 && velocity === 0)) { // note off
						stopNoteHold(note);
					}
				};
			}
		});
	}, []);

	// ------------------ Note Handlers ----------------
	const handleIncomingNote = (note: string) => {
		if (!note) return;

		pressedNotes.current.add(note);

		if (chordTimer.current) clearTimeout(chordTimer.current);
		chordTimer.current = setTimeout(() => {
			const notes = Array.from(pressedNotes.current);

			// Reset activeNotes to only the new chord
			setActiveNotes(sortNotesByPitch(notes));

			// Play the notes
			notes.forEach(n => startNoteHold(n));
		}, CHORD_THRESHOLD);
	};

	// --------------- Sequence Handlers --------------
	const handleSequencePlay = (startIndex = 0, loop: boolean) => {
		if (!savedChords.length) return;

		const engineChords = savedChords.map(c => ({
			notes: c.notes,
			durationBeats: c.duration ?? 1, 
		}));

		audioEngineRef.current.playSequence(
			engineChords,
			startIndex,
			loop,
			(chord, index) => {
				setPlayheadIndex(index);
				setActiveNotes(sortNotesByPitch(chord.notes));
				const matches = detectChord(chord.notes);
				setChordName(matches.length ? matches[0] : "—");
			}
		);
	};

	// --------------- Note Play Handlers --------------
	const handlePreviewChord = (chord: { notes: string[] }) => {
		setActiveNotes(sortNotesByPitch(chord.notes));

		const matches = detectChord(chord.notes);
		setChordName(matches.length ? matches[0] : "—");
	};

	const startNoteHold = (note: string) => {
		if (!pressedNotes.current.has(note)) {
			pressedNotes.current.add(note);
		}
		// play with long duration; will stop manually on keyup
		audioEngineRef.current.playNote(note, 60);
	};

	const stopNoteHold = (note: string) => {
		pressedNotes.current.delete(note);
		audioEngineRef.current.stopNote(note);
	};

	const playNoteOnce = (note: string) => {
		audioEngineRef.current.stopSequence();
		audioEngineRef.current.playNote(note, 0.5);
	};


	// ---------------- Keyboard / Octave ----------------
	const getNoteFromKey = (key: string) => {
		if (BASE_KEYBOARD[key]) return BASE_KEYBOARD[key] + baseOctave;
		if (EXTRA_KEYBOARD[key]) return EXTRA_KEYBOARD[key] + (baseOctave + 1);
		return null;
	};

	// ---------------- Sliding Window ----------------
	visibleKeys.forEach(key => {
		if (!key.includes("#")) return;
		const pred = KEYS[KEYS.indexOf(key) - 1];
		if (!pred) return;
		const predLetter = pred.match(/[A-G]/)?.[0];
		if (!predLetter) return;
		const idx = visibleWhiteKeys.indexOf(pred);
		const offset = blackKeyOffsetMap[predLetter];
		if (offset === undefined || idx === -1) return;
		blackKeyPositions.push({ note: key, leftPosition: idx * whiteKeyWidth + offset });
	});

	// ---------------- Helpers ----------------
	function midiNoteToName(midi: number): string | null {
		const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
		if (midi < 0 || midi > 127) return null;
		const note = NOTES[midi % 12];
		const octave = Math.floor(midi / 12) - 1;
		return `${note}${octave}`;
	}

	const currentChord = activeNotes.length > 0 && chordName !== "—"
		? { label: chordName, notes: activeNotes }
		: null;

	// ---------------- Render ----------------
	return (
		<div className="bg-gray-900 min-h-screen p-8 text-white flex flex-col items-center">
			<h1 className="text-3xl font-bold mb-6 text-center">🎹 Chord Tool</h1>

			<Keyboard
				visibleKeys={visibleKeys}
				visibleWhiteKeys={visibleWhiteKeys}
				blackKeyPositions={blackKeyPositions}
				activeNotes={activeNotes}
				toggleNote={(note: string) => {
					setActiveNotes(prev => {
						const updated = prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note];
						playNoteOnce(note); // play single note
						return sortNotesByPitch(updated);
					});
				}}

				whiteKeyWidth={whiteKeyWidth}
				audioEngine={audioEngineRef.current}
			/>

			<ChordDisplay chord={currentChord} chordName={chordName} audioEngine={audioEngineRef.current} />

			<ChordTimeline
				timeline={savedChords}
				setTimeline={setSavedChords}
				noteToFreq={() => null}
				width={keyBoardWith}
				audioEngine={audioEngineRef.current}
				playSequence={() => handleSequencePlay(0, loop)}
				onPreviewChord={handlePreviewChord}
				loop={loop}
				setLoop={setLoop}
				playheadIndex={playheadIndex}
			/>

			<div className="mt-4">
				<ChordImportExport savedChords={savedChords} setSavedChords={setSavedChords} />
			</div>
		</div>
	);
}
