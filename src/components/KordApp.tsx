import { useState, useEffect, useRef } from "react";
import { detect as detectChord } from "@tonaljs/chord-detect";
import { Note } from "@tonaljs/tonal";
import Keyboard from "./Keyboard"; 
import SavedChordsPanel from "./SavedChordsPanel";
import ChordTimeline from "./ChordsTimeline";
import ChordImportExport from "./ChordImportExport";
import ChordDisplay from "./ChordDisplay";


//////// CONSTANTS & HELPERS ///////

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

const BASE_KEYBOARD: Record<string, string> = {
	a: "C", w: "C#", s: "D", e: "D#", d: "E",
	f: "F", t: "F#", g: "G", y: "G#", h: "A", u: "A#", j: "B"
};

const EXTRA_KEYBOARD: Record<string, string> = {
	i: "C", k: "C#", o: "D", l: "D#", p: "E"
};

const audioCtx = new (window.AudioContext)();
const CHORD_THRESHOLD = 50;
const VISIBLE_KEYS_COUNT = 37;

/////// MUSIC FUNCTIONS ///////

function playTone(freq: number | null, duration = 1.5) {
	if (freq == null) return;

	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	osc.frequency.value = freq;
	osc.type = "sine";

	osc.connect(gain);
	gain.connect(audioCtx.destination);

	osc.start();
	gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
	osc.stop(audioCtx.currentTime + duration);
}

function noteToFreq(note?: string) {
	if (!note) return null;
	const match = note.match(/^([A-G]#?)(\d)$/);
	if (!match) return null;

	const [, n, octaveStr] = match;
	const octave = parseInt(octaveStr, 10);
	if (isNaN(octave)) return null;

	const NOTES: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
	const noteVal = NOTES[n];
	if (noteVal === undefined) return null;

	const semitones = noteVal + (octave - 4) * 12;
	return 440 * Math.pow(2, (semitones - 9) / 12);
}

function midiNoteToName(midi: number): string | null {
	const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	if (midi < 0 || midi > 127) return null;
	const note = NOTES[midi % 12];
	const octave = Math.floor(midi / 12) - 1;
	return `${note}${octave}`;
}

function sortNotesByPitch(notes: string[]) {
	return [...notes].sort((a, b) => {
		const ma = Note.midi(a);
		const mb = Note.midi(b);
		if (ma == null || mb == null) return 0;
		return ma - mb;
	});
}

///////// COMPONENT /////////

export default function KordApp() {
	const [activeNotes, setActiveNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState<string>("—");
	const [baseOctave, setBaseOctave] = useState(3);
	const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pressedNotes = useRef<Set<string>>(new Set());

	// saved chords state
	type SavedChord = { label: string; notes: string[] };
	const [savedChords, setSavedChords] = useState<SavedChord[]>([]);

	const currentChord = activeNotes.length > 0 && chordName && chordName !== "—"
		? { label: chordName, notes: activeNotes }
		: null;

	//// CHORD DETECTION
	useEffect(() => {
		if (activeNotes.length === 0) {
			setChordName("—");
			return;
		}
		const matches = detectChord([...activeNotes].sort());
		setChordName(matches.length ? matches[0] : "—");
	}, [activeNotes]);

	//// HANDLE NOTES (QWERTY & MIDI)
	const handleIncomingNote = (note: string) => {
		if (!note) return;
		pressedNotes.current.add(note);

		if (chordTimer.current) clearTimeout(chordTimer.current);

		chordTimer.current = setTimeout(() => {
			const notes = Array.from(pressedNotes.current);
			pressedNotes.current.clear();

			if (notes.length > 0) {
				setActiveNotes(prev => {
					// merge the new notes with existing ones if length === 1
					const mergedNotes = notes.length === 1 ?
						(prev.includes(notes[0]) ? prev.filter(n => n !== notes[0]) : [...prev, notes[0]])
						: notes;

					// always sort before returning
					return sortNotesByPitch(mergedNotes);
				});
			}

			notes.forEach(n => playTone(noteToFreq(n), 0.5));
		}, CHORD_THRESHOLD);
	};

	//// TOGGLE NOTE
	const toggleNote = (note: string) => {
		if (!note) return;
		if (audioCtx.state === "suspended") audioCtx.resume();

		setActiveNotes(prev => {
			const updated = prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note];
			playTone(noteToFreq(note), 0.5);
			return updated;
		});
	};

	//// GET NOTE FROM KEY
	const getNoteFromKey = (key: string) => {
		if (BASE_KEYBOARD[key]) return BASE_KEYBOARD[key] + baseOctave;
		if (EXTRA_KEYBOARD[key]) return EXTRA_KEYBOARD[key] + (baseOctave + 1);
		return null;
	};

	//// QWERTY HANDLERS
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "z") {
			setBaseOctave(prev => Math.max(1, prev - 1));
			return;
		}
		if (e.key === "x") {
			setBaseOctave(prev => Math.min(4, prev + 1)); // max start octave = 4 for 37 keys
			return;
		}

		const note = getNoteFromKey(e.key.toLowerCase());
		if (!note) return;
		if (!pressedNotes.current.has(note)) handleIncomingNote(note);
	};

	const handleKeyUp = (e: KeyboardEvent) => {
		const note = getNoteFromKey(e.key.toLowerCase());
		if (!note) return;
		pressedNotes.current.delete(note);
	};

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [baseOctave]);

	//// MIDI INPUT (fixed to stick notes)
	useEffect(() => {
		if (!navigator.requestMIDIAccess) return;

		navigator.requestMIDIAccess().then(midi => {
			for (let input of midi.inputs.values()) {
				input.onmidimessage = (msg) => {
					if (!msg.data) return;
					const [status, key, velocity] = msg.data;
					const note = midiNoteToName(key);
					if (!note) return;

					if (status === 144 && velocity > 0) {
						// Note ON → handle like keyboard
						if (!pressedNotes.current.has(note)) handleIncomingNote(note);
					}

					if (status === 128 || (status === 144 && velocity === 0)) {
						// Note OFF → remove from pressedNotes only
						pressedNotes.current.delete(note);
						// do NOT remove from activeNotes immediately
					}
				};
			}
		});
	}, []);

	//// SLIDING WINDOW
	const startIndex = Math.min(Math.max(0, KEYS.findIndex(k => parseInt(k.slice(-1)) === baseOctave)), KEYS.length - VISIBLE_KEYS_COUNT);
	const visibleKeys = KEYS.slice(startIndex, startIndex + VISIBLE_KEYS_COUNT);
	const visibleWhiteKeys = visibleKeys.filter(k => !k.includes("#"));

	//// BLACK KEY POSITIONS
	const blackKeyPositions: { note: string; leftPosition: number }[] = [];
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

	//// RENDER
	return (
		<div className="bg-gray-900 min-h-screen p-8 text-white flex flex-col items-center">
			<h1 className="text-3xl font-bold mb-6 text-center">🎹 Chord Tool</h1>

			<Keyboard
				visibleKeys={visibleKeys}
				visibleWhiteKeys={visibleWhiteKeys}
				blackKeyPositions={blackKeyPositions}
				activeNotes={activeNotes}
				toggleNote={toggleNote}
				whiteKeyWidth={whiteKeyWidth}
			/>

			<ChordDisplay
				chord={currentChord}
				chordName={chordName}
				activeNotes={activeNotes}
				playTone={playTone}
				noteToFreq={noteToFreq}
			/>

			<SavedChordsPanel
				savedChords={savedChords}
				setSavedChords={setSavedChords}
				setActiveNotes={setActiveNotes}
				playTone={playTone}
				noteToFreq={noteToFreq}
			/>

			<ChordTimeline
				timeline={savedChords}
				setTimeline={setSavedChords}
				noteToFreq={noteToFreq}
				width={`${visibleWhiteKeys.length * whiteKeyWidth}px`}  // SAME AS KEYBOARD
			/>

			<div className="mt-4">
				<ChordImportExport
					savedChords={savedChords}
					setSavedChords={setSavedChords}
				/>
			</div>

		</div>
	);
}
