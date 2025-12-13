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
const CHORD_THRESHOLD = 50;

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
	const [activeNotes, setActiveNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState("—");
	const [baseOctave, setBaseOctave] = useState(3);
	const [savedChords, setSavedChords] = useState<any[]>([]);
	const [loop, setLoop] = useState(false);
	const [playheadIndex, setPlayheadIndex] = useState<number | null>(null);
	const [keyboardWidth, setKeyboardWidth] = useState<number>(0);


	/* ---------- refs ---------- */
	const audioEngineRef = useRef(new AudioEngine(120, "sine"));
	const pressedNotes = useRef<Set<string>>(new Set());
	const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	/* ---------- AudioContext resume (required) ---------- */
	useEffect(() => {
		const resume = () => audioEngineRef.current.resumeContext();
		window.addEventListener("mousedown", resume, { once: true });
		window.addEventListener("keydown", resume, { once: true });
		window.addEventListener("touchstart", resume, { once: true });
		return () => {
			window.removeEventListener("mousedown", resume);
			window.removeEventListener("keydown", resume);
			window.removeEventListener("touchstart", resume);
		};
	}, []);

	/* ---------- chord detection ---------- */
	useEffect(() => {
		if (!activeNotes.length) {
			setChordName("—");
			return;
		}

		const notes = sortNotesByPitch(activeNotes);
		const matches = detectChord(notes);

		if (matches.length) {
			// 🔥 chord takes ownership
			resetManualNotes();

			audioEngineRef.current.playChord({
				notes,
				durationBeats: 1,
			});
		}

		setChordName(matches.length ? matches[0] : "—");
	}, [activeNotes]);


	/* ---------- unified NOTE ON ---------- */
	const handleNoteOn = (note: string) => {
		if (pressedNotes.current.has(note)) return;
		pressedNotes.current.add(note);

		if (chordTimer.current) clearTimeout(chordTimer.current);
		chordTimer.current = setTimeout(() => {
			const notes = Array.from(pressedNotes.current);
			setActiveNotes(sortNotesByPitch(notes));
			notes.forEach(n => audioEngineRef.current.playNote(n, 60));
		}, CHORD_THRESHOLD);
	};

	/* ---------- unified NOTE OFF ---------- */
	const handleNoteOff = (note: string) => {
		pressedNotes.current.delete(note);
		audioEngineRef.current.stopNote(note);
	};


	/* ---------- play single note (mouse click) ---------- */
	const playNoteOnce = (note: string) => {
		setActiveNotes(prev => {
			const exists = prev.includes(note);

			let next: string[];
			if (exists) {
				pressedNotes.current.delete(note);
				audioEngineRef.current.stopNote(note);
				next = prev.filter(n => n !== note);
			} else {
				pressedNotes.current.add(note);
				audioEngineRef.current.playNote(note, 0.5);
				next = [...prev, note];
			}

			return sortNotesByPitch(next);
		});
	};

	/* ---------- reset manual notes ---------- */
	const resetManualNotes = () => {
		pressedNotes.current.forEach(n =>
			audioEngineRef.current.stopNote(n)
		);
		pressedNotes.current.clear();
	};

	/* ---------- sequence playback ---------- */
	const handleSequencePlay = (startIndex = 0) => {
		if (!savedChords.length) return;

		resetManualNotes();

		audioEngineRef.current.playSequence(
			savedChords.map(c => ({
				notes: c.notes,
				durationBeats: c.duration ?? 1,
			})),
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

	/* ---------- timeline preview ---------- */
	const handlePreviewChord = (chord: { notes: string[]; duration?: number }) => {
		resetManualNotes();

		audioEngineRef.current.stopSequence();
		setActiveNotes(sortNotesByPitch(chord.notes));
		
		const matches = detectChord(chord.notes);
		setChordName(matches.length ? matches[0] : "—");

		audioEngineRef.current.playChord({
			notes: chord.notes,
			durationBeats: chord.duration ?? 1,
		});
	};

	const currentChord =
		activeNotes.length && chordName !== "—"
			? { label: chordName, notes: activeNotes }
			: null;

	/* ---------- render ---------- */
	return (
		<div className="bg-gray-900 min-h-screen p-8 text-white flex flex-col items-center">
			<h1 className="text-3xl font-bold mb-6">🎹 Chord Tool</h1>

			<Keyboard
				baseOctave={baseOctave}
				setBaseOctave={setBaseOctave}
				activeNotes={activeNotes}
				onNoteOn={handleNoteOn}
				onNoteOff={handleNoteOff}
				onNoteClick={playNoteOnce}
				onWidthChange={setKeyboardWidth}
			/>

			<ChordDisplay
				chord={currentChord}
				chordName={chordName}
				audioEngine={audioEngineRef.current}
			/>

			<ChordTimeline
				timeline={savedChords}
				setTimeline={setSavedChords}
				width={keyboardWidth}
				audioEngine={audioEngineRef.current}
				playSequence={handleSequencePlay}
				onPreviewChord={handlePreviewChord}
				loop={loop}
				setLoop={setLoop}
				playheadIndex={playheadIndex}
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
