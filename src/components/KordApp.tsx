// src/KordApp.tsx
import { useEffect, useRef, useState } from "react";
import { detect as detectChord } from "@tonaljs/chord-detect";
import { Note } from "@tonaljs/tonal";

import { AudioEngine } from "../helpers/AudioEngine";
import Keyboard from "./Keyboard";
import ChordTimeline from "./ChordsTimeline";
import ChordImportExport from "./ChordImportExport";
import ChordDisplay from "./ChordDisplay";

const BEATS_PER_BAR = 4;

function sortNotesByPitch(notes: string[]) {
	return [...notes].sort((a, b) => {
		const ma = Note.midi(a);
		const mb = Note.midi(b);
		if (ma == null || mb == null) return 0;
		return ma - mb;
	});
}

export default function KordApp() {
	/* ---------- state ---------- */
	const [currentChordNotes, setCurrentChordNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState("—");

	const [baseOctave, setBaseOctave] = useState(4);
	const [savedChords, setSavedChords] = useState<any[]>([]);
	const [loop, setLoop] = useState(false);
	const [playheadIndex, setPlayheadIndex] = useState<number | null>(null);
	const [keyboardWidth, setKeyboardWidth] = useState<number>(0);
	const [soundReady, setSoundReady] = useState(false);

	/* ---------- refs ---------- */
	const audioEngine = useRef(new AudioEngine(120, "sine"));
	const keyboardNotes = useRef<Set<string>>(new Set());

	useEffect(() => {
		audioEngine.current.loadSoundfont("acoustic_grand_piano");
	}, []);

	useEffect(() => {
		audioEngine.current.loadSoundfont("acoustic_grand_piano")
			.then(() => setSoundReady(true));
	}, []);

	/* ---------- resume audio ---------- */
	useEffect(() => {
		const unlockAudio = () => {
			audioEngine.current.resumeContext();
			audioEngine.current.loadSoundfont("acoustic_grand_piano");
			setSoundReady(true);
		};

		window.addEventListener("mousedown", unlockAudio, { once: true });
		window.addEventListener("keydown", unlockAudio, { once: true });
		window.addEventListener("touchstart", unlockAudio, { once: true });
		return () => {
			window.removeEventListener("mousedown", unlockAudio);
			window.removeEventListener("keydown", unlockAudio);
			window.removeEventListener("touchstart", unlockAudio);
		};
	}, []);

	/* ---------- KEYBOARD NOTE ON ---------- */
	const handleNoteOn = (note: string) => {
		keyboardNotes.current.add(note);

		const chord = sortNotesByPitch(Array.from(keyboardNotes.current));

		// 🔒 COMMIT chord
		setCurrentChordNotes(chord);

		const matches = detectChord(chord);
		setChordName(matches.length ? matches[0] : "—");

		if (!soundReady) return;
		audioEngine.current.playChord({ notes: chord });
	};

	/* ---------- KEYBOARD NOTE OFF ---------- */
	const handleNoteOff = (note: string) => {
		keyboardNotes.current.delete(note);
		audioEngine.current.stopNote(note);
	};

	/* ---------- MOUSE CLICK NOTE ---------- */
	const playNoteOnce = (note: string) => {
		let next: string[];

		if (currentChordNotes.includes(note)) {
			next = currentChordNotes.filter(n => n !== note);
		} else {
			next = [...currentChordNotes, note];
			audioEngine.current.playNote(note, 0.5);
		}

		next = sortNotesByPitch(next);

		setCurrentChordNotes(next);

		const matches = detectChord(next);
		setChordName(matches.length ? matches[0] : "—");
	};

	/* ---------- SEQUENCE ---------- */
	const handleSequencePlay = (startIndex = 0) => {
		if (!savedChords.length) return;

		audioEngine.current.playSequence(
			savedChords.map(c => ({
				notes: c.notes,
				durationBeats: (c.duration ?? 1) * BEATS_PER_BAR,
			})),
			startIndex,
			loop,
			(chord, index) => {
				const notes = sortNotesByPitch(chord.notes);

				setPlayheadIndex(index);

				// 🔒 COMMIT chord
				setCurrentChordNotes(notes);

				const matches = detectChord(notes);
				setChordName(matches.length ? matches[0] : "—");
			}
		);
	};

	/* ---------- TIMELINE PREVIEW ---------- */
	const handlePreviewChord = (chord: { notes: string[]; duration?: number }) => {
		const notes = sortNotesByPitch(chord.notes);

		// 🔒 COMMIT chord
		setCurrentChordNotes(notes);

		const matches = detectChord(notes);
		setChordName(matches.length ? matches[0] : "—");

		audioEngine.current.playChord({
			notes,
			durationBeats: chord.duration ?? 1,
		});
	};

	const safeNoteOn = (note: string) => {
		if (!soundReady) return;
		handleNoteOn(note);
	};

	const safeNoteOff = (note: string) => {
		if (!soundReady) return;
		handleNoteOff(note);
	};

	const safeNoteClick = (note: string) => {
		if (!soundReady) return;
		playNoteOnce(note);
	};

	const currentChord =
		currentChordNotes.length && chordName !== "—"
			? { label: chordName, notes: currentChordNotes }
			: null;

			
	/* ---------- render ---------- */
	return (
		<div className="bg-gray-900 min-h-screen p-8 text-white flex flex-col items-center">
			<h1 className="text-3xl font-bold mb-6">🎹 Chord Tool</h1>

			{!soundReady && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
					<button className="px-6 py-3 text-xl bg-green-500 rounded">
						Click to enable audio
					</button>
				</div>
			)}

			<Keyboard
				baseOctave={baseOctave}
				setBaseOctave={setBaseOctave}
				activeNotes={currentChordNotes}
				onNoteOn={safeNoteOn}
				onNoteOff={safeNoteOff}
				onNoteClick={safeNoteClick}
				onWidthChange={setKeyboardWidth}
				disabled={!soundReady}
			/>

			<ChordDisplay
				chord={currentChord}
				chordName={chordName}
				audioEngine={audioEngine.current}
			/>

			<ChordTimeline
				timeline={savedChords}
				setTimeline={setSavedChords}
				width={keyboardWidth}
				audioEngine={audioEngine.current}
				playSequence={handleSequencePlay}
				onPreviewChord={handlePreviewChord}
				loop={loop}
				setLoop={setLoop}
				playheadIndex={playheadIndex}
				setPlayheadIndex={setPlayheadIndex}
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
