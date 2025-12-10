import { useState, useEffect, useRef } from "react";
import { detect as detectChord } from "@tonaljs/chord-detect";

//////// CONSTANTS & HELPERS ///////

const KEYS = [
	"C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
	"C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
	"C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
	"C6"
];
const whiteKeys = KEYS.filter(k => !k.includes("#"));
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

///////// COMPONENT /////////

export default function KordApp() {
	const [activeNotes, setActiveNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState<string>("—");
	const [baseOctave, setBaseOctave] = useState(4);
	const chordTimer = useRef<NodeJS.Timeout | null>(null);
	const pressedNotes = useRef<Set<string>>(new Set());

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

			if (notes.length > 1) {
				// Multi-note chord: replace selection
				setActiveNotes(notes);
			} else if (notes.length === 1) {
				// Single key: toggle
				setActiveNotes(prev => {
					const newNotes = prev.includes(notes[0]) ? prev.filter(n => n !== notes[0]) : [...prev, notes[0]];
					return newNotes;
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

	//// MIDI INPUT
	useEffect(() => {
		if (!navigator.requestMIDIAccess) return;

		navigator.requestMIDIAccess().then(midi => {
			for (let input of midi.inputs.values()) {
				input.onmidimessage = (msg) => {
					const [status, key, velocity] = msg.data;
					const note = midiNoteToName(key);
					if (!note) return;

					if (status === 144 && velocity > 0) handleIncomingNote(note);
					if (status === 128 || (status === 144 && velocity === 0)) {
						setActiveNotes(prev => prev.filter(n => n !== note));
					}
				};
			}
		});
	}, []);

	//// BLACK KEY POSITIONS
	const blackKeyPositions: { note: string; leftPosition: number }[] = [];
	KEYS.forEach(key => {
		if (key.includes("#")) {
			const pred = KEYS[KEYS.indexOf(key) - 1];
			if (!pred) return;
			const predLetter = pred.match(/[A-G]/)?.[0];
			if (!predLetter) return;
			const idx = whiteKeys.indexOf(pred);
			const offset = blackKeyOffsetMap[predLetter];
			if (offset === undefined) return;
			blackKeyPositions.push({ note: key, leftPosition: whiteKeys.indexOf(pred) * whiteKeyWidth + offset });
		}
	});

	//// RENDER
	return (
		<div className="bg-gray-900 min-h-screen p-6 text-white flex flex-col items-center">
			<h1 className="text-3xl font-bold mb-6 text-center">🎹 Chord Tool</h1>

			<div id="keyboard-wrapper" className="p-4 bg-gray-800 rounded-xl shadow-lg">
				<div
					className="relative mx-auto"
					style={{ width: `${whiteKeys.length * whiteKeyWidth}px`, height: "200px" }}
				>
					<div className="flex">
						{whiteKeys.map(note => (
							<div
								key={note}
								onClick={() => toggleNote(note)}
								className={`w-[48px] h-[192px] border border-gray-300 rounded-b-lg relative z-0 cursor-pointer transition shadow-md ${activeNotes.includes(note) ? "bg-blue-400" : "bg-white"
									}`}
							/>
						))}
					</div>

					{blackKeyPositions.map(({ note, leftPosition }) => (
						<div
							key={note}
							onClick={() => toggleNote(note)}
							className={`w-[32px] h-[128px] absolute top-0 z-10 rounded-b-md cursor-pointer transition shadow-2xl ${activeNotes.includes(note) ? "bg-blue-800" : "bg-black"
								}`}
							style={{ left: `${leftPosition}px`, top: 0 }}
						/>
					))}
				</div>
			</div>

			---

			<div
				id="chord-display"
				className="mt-4 p-4 bg-green-500 text-white rounded-lg text-2xl font-bold text-center w-full max-w-[300px] shadow-lg"
			>
				{chordName}
			</div>

			<div
				id="selected"
				className="mt-6 p-3 bg-gray-100 text-gray-900 rounded text-xl text-center w-full max-w-[600px]"
			>
				Selected Notes: {activeNotes.join(" • ") || "None"}
			</div>

			<div id="play" className="flex justify-center mt-4">
				<button
					onClick={() => activeNotes.forEach(n => playTone(noteToFreq(n), 1))}
					className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
				>
					▶ Play Chord
				</button>
			</div>
		</div>
	);
}
