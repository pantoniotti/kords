import { useState, useEffect } from "react";
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
const blackKeyOffsetMap: Record<string, number> = {
	C: 32, D: 30, F: 30, G: 30, A: 30,
};
// QWERTY piano layout
const KEYBOARD_MAP: Record<string, string> = {
	a: "C4",
	w: "C#4",
	s: "D4",
	e: "D#4",
	d: "E4",
	f: "F4",
	t: "F#4",
	g: "G4",
	y: "G#4",
	h: "A4",
	u: "A#4",
	j: "B4",
};
const audioCtx = new (window.AudioContext)();

/////// MUSIC FUNCTIONS ///////

function playTone(freq: number | null, duration = 1.5) {
	// Use the globally declared audioCtx
	if (freq == null) return;

	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	// 1. Setup
	osc.frequency.value = freq;
	osc.type = "sine"; // Or "triangle", "square"

	// 2. Connect
	osc.connect(gain);
	gain.connect(audioCtx.destination);

	// 3. Play
	osc.start();

	// 4. Decay (Smooth fade out)
	gain.gain.setValueAtTime(0.5, audioCtx.currentTime); // Start volume
	gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

	// 5. Stop
	osc.stop(audioCtx.currentTime + duration);
}

function noteToFreq(note: string) {
	const A4 = 440;
	const NOTES: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
	const match = note.match(/([A-G]#?)(\d)/);
	if (!match) return null;
	const [, n, octave] = match;
	const octaveNum = parseInt(octave, 10);
	const noteValue = NOTES[n];
	if (noteValue === undefined || Number.isNaN(octaveNum)) return null;
	const semitones = noteValue + (octaveNum - 4) * 12;
	return A4 * Math.pow(2, (semitones - 9) / 12);
}

function midiNoteToName(midi: number): string | null {
	const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	const note = NOTES[midi % 12];
	const octave = Math.floor(midi / 12) - 1;
	return `${note}${octave}`;
}

// 🎵 COMPONENT
export default function KordApp() {
	const [activeNotes, setActiveNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState<string>("—");

	// 🎵 CHORD DETECTION
	useEffect(() => {
		if (activeNotes.length === 0) {
			setChordName("—");
			return;
		}

		const names = [...activeNotes].sort();
		const matches = detectChord(names);

		if (matches.length === 0) {
			setChordName("—");
		} else {
			setChordName(matches[0]); // Best match
		}
	}, [activeNotes]);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [activeNotes]);

	//
	useEffect(() => {
		if (!navigator.requestMIDIAccess) return;

		navigator.requestMIDIAccess().then(midi => {
			const inputs = midi.inputs.values();

			for (let input of inputs) {
				input.onmidimessage = (msg) => {
					const [status, key, velocity] = msg.data;

					const noteNumber = key; // MIDI note 0–127

					const note = midiNoteToName(noteNumber);
					if (!note) return;

					// Note ON (status 144, velocity > 0)
					if (status === 144 && velocity > 0) {
						if (!activeNotes.includes(note)) toggleNote(note);
					}

					// Note OFF (status 128, or velocity 0)
					if (status === 128 || (status === 144 && velocity === 0)) {
						setActiveNotes(prev => prev.filter(n => n !== note));
					}
				};
			}
		});
	}, []);

	const toggleNote = (note: string) => {
		// Resume audio context on click
		if (audioCtx.state === 'suspended') {
			audioCtx.resume();
		}

		// Update active notes
		setActiveNotes(prev => {
			const newNotes = prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note];
			// Play tone immediately
			playTone(noteToFreq(note), 0.5);
			return newNotes;
		});
	};

	// const toggleNote = (note: string) => {
	//   setActiveNotes(prev =>
	//     prev.includes(note)
	//       ? prev.filter(n => n !== note)
	//       : [...prev, note]
	//   );

	//   playTone(noteToFreq(note), 0.5);
	// };


	// --- Black Key Position Calculation (Robust Logic) ---
	const blackKeyPositions: { note: string; leftPosition: number }[] = [];

	KEYS.forEach((key) => {
		if (key.includes("#")) {
			const predecessorNote = KEYS[KEYS.indexOf(key) - 1];
			if (!predecessorNote || !predecessorNote.match(/[A-G]/)) return;

			const predecessorNoteLetter = predecessorNote.match(/[A-G]/)[0];
			const leftIndex = whiteKeys.indexOf(predecessorNote);
			const offset = blackKeyOffsetMap[predecessorNoteLetter];

			if (offset === undefined) return;

			const leftPosition = whiteKeyWidth * leftIndex + offset;
			blackKeyPositions.push({ note: key, leftPosition });
		}
	});


	const handleKeyDown = (e: KeyboardEvent) => {
		const note = KEYBOARD_MAP[e.key.toLowerCase()];
		if (!note) return;

		// Prevent key repeating from retriggering endlessly
		if (activeNotes.includes(note)) return;

		toggleNote(note);
	};

	const handleKeyUp = (e: KeyboardEvent) => {
		const note = KEYBOARD_MAP[e.key.toLowerCase()];
		if (!note) return;

		// Key released → remove note
		setActiveNotes(prev => prev.filter(n => n !== note));
	};


	return (
		<div className="bg-gray-900 min-h-screen p-6 text-white flex flex-col items-center">
			<h1 className="text-3xl font-bold mb-6 text-center">🎹 Chord Tool</h1>

			<div id="keyboard-wrapper" className="p-4 bg-gray-800 rounded-xl shadow-lg">
				{/* Inner Container: relative parent, handles width and centering */}
				<div
					className="relative mx-auto"
					style={{ width: `${whiteKeys.length * whiteKeyWidth}px`, height: "200px" }}
				>

					{/* White keys container: Uses flex to guarantee a horizontal row */}
					<div className="flex">
						{whiteKeys.map((note) => (
							<div
								key={note}
								onClick={() => toggleNote(note)}
								// Added shadow-md for better visual depth
								className={
									`w-[48px] h-[192px] border border-gray-300 rounded-b-lg 
									relative z-0 cursor-pointer transition shadow-md
		                  			${activeNotes.includes(note) ? 'bg-blue-400' : 'bg-white'}`
								}
							/>
						))}
					</div>

					{/* Black keys: absolute position, z-index 10 */}
					{blackKeyPositions.map(({ note, leftPosition }) => (
						<div
							key={note}
							onClick={() => toggleNote(note)}
							// 🔥 CRITICAL CHANGE: Added shadow-2xl to force visibility if color is somehow transparent
							className={
								`w-[32px] h-[128px] absolute top-0 z-10 rounded-b-md 
								cursor-pointer transition shadow-2xl
		            		    ${activeNotes.includes(note) ? 'bg-blue-800' : 'bg-black'}`
							}
							style={
								{ left: `${leftPosition}px`, top: '0px' }
							}
						/>
					))}
				</div>
			</div>

			---

			{/* Chord Display Box */}
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
					onClick={() => activeNotes.forEach((n) => playTone(noteToFreq(n), 1))}
					className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
				>
					▶ Play Chord
				</button>
			</div>
		</div>
	);
}