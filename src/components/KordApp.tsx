// src/KordApp.tsx
import { useEffect, useRef, useState } from "react";
import { detect as detectChord } from "@tonaljs/chord-detect";
import { Note, Midi } from "@tonaljs/tonal";

import { AudioEngine, type InstrumentId } from "../helpers/AudioEngine";
import Keyboard from "./Keyboard";
import ChordTimeline from "./ChordsTimeline";
import ChordImportExport from "./ChordImportExport";
import ChordDisplay from "./ChordDisplay";

const BEATS_PER_BAR = 4;

/* ---------- helpers ---------- */
function sortNotesByPitch(notes: string[]) {
	return [...notes].sort((a, b) => {
		const ma = Note.midi(a);
		const mb = Note.midi(b);
		if (ma == null || mb == null) return 0;
		return ma - mb;
	});
}

/* ---------- component ---------- */
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
	const [instrument, setInstrument] = useState<InstrumentId>("acoustic_grand_piano");
	const [isPlaying, setIsPlaying] = useState(false);

	/* ---------- refs ---------- */
	const audioEngine = useRef(new AudioEngine(120, "sine"));

	// notes currently physically held down (keyboard + MIDI)
	const pressedNotes = useRef<Set<string>>(new Set());

	const soundReadyRef = useRef(false);

	/* ---------- change instrument ---------- */
	const changeInstrument = async (id: InstrumentId) => {
		await audioEngine.current.loadSoundfont(id);

		if (id.includes("pad")) audioEngine.current.setReleaseTime(1.2);
		else if (id.includes("string")) audioEngine.current.setReleaseTime(0.8);
		else audioEngine.current.setReleaseTime(0.25);

		setInstrument(id);
	};

	/* ---------- spacebar transport ---------- */
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;

			if (e.code === "Space") {
				e.preventDefault();
				if (isPlaying) stopSequence();
				else handlePlaySequence(0);
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isPlaying, savedChords, loop]);


	/* ---------- sound ready ref ---------- */
	useEffect(() => {
		soundReadyRef.current = soundReady;
	}, [soundReady]);

	/* ---------- resume audio ---------- */
	useEffect(() => {
		const unlockAudio = async () => {
			audioEngine.current.resumeContext();
			await audioEngine.current.loadSoundfont("acoustic_grand_piano");
			setSoundReady(true); // ✅ only set after SoundFont is loaded
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

	/* ---------- spacebar transport ---------- */
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			// prevent auto-repeat
			if (e.repeat) return;

			if (e.code === "Space") {
				e.preventDefault();

				if (isPlaying) {
					stopSequence();
				} else {
					handlePlaySequence(0);
				}
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isPlaying, savedChords, loop]);


	/* ---------- MIDI support ---------- */
	useEffect(() => {
		if (!navigator.requestMIDIAccess) {
			console.warn("Web MIDI not supported");
			return;
		}

		let midi: MIDIAccess | null = null;

		const onMidiMessage = (e: MIDIMessageEvent) => {
			if (!soundReadyRef.current) return;
			if (!e.data) return;

			const [status, noteNumber, velocity = 0] = e.data;
			const command = status & 0xf0;

			const note = Midi.midiToNoteName(noteNumber, { sharps: true });

			if (!note) return;

			// NOTE ON (velocity > 0)
			if (command === 0x90 && velocity > 0) {
				handleNoteOn(note);
			}
			// NOTE OFF (0x80 or NoteOn with velocity 0)
			else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
				handleNoteOff(note);
			}
		};

		navigator.requestMIDIAccess().then(access => {
			midi = access;

			for (const input of midi.inputs.values()) {
				input.onmidimessage = onMidiMessage;
			}

			// Handle hot-plugging MIDI devices
			midi.onstatechange = () => {
				for (const input of midi!.inputs.values()) {
					input.onmidimessage = onMidiMessage;
				}
			};
		});

		return () => {
			if (!midi) return;
			for (const input of midi.inputs.values()) {
				input.onmidimessage = null;
			}
		};
	}, []);

	/* ---------- Keyboard press ---------- */
	const handleNoteOn = (note: string) => {
		if (!soundReadyRef.current) return;

		// already held → ignore (important for polyphony)
		if (pressedNotes.current.has(note)) return;

		pressedNotes.current.add(note);

		// 🔊 audio: play ONLY this note
		audioEngine.current.playNote(note);

		// 🎼 commit chord visually
		const chord = sortNotesByPitch(Array.from(pressedNotes.current));
		setCurrentChordNotes(chord);

		const matches = detectChord(chord);
		setChordName(matches.length ? matches[0] : "—");
	};

	/* ---------- Keyboard release ---------- */
	const handleNoteOff = (note: string) => {
		if (!soundReadyRef.current) return;

		if (!pressedNotes.current.has(note)) return;

		pressedNotes.current.delete(note);

		// 🔊 audio only
		audioEngine.current.stopNote(note);
	};

	/* ---------- Mouse click ---------- */
	const handleNoteClick = (note: string) => {
		if (!soundReadyRef.current) return;

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

	/* ---------- Play sequence ---------- */
	const handlePlaySequence = (startIndex = 0) => {
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

		setIsPlaying(true);
	};

	/* ---------- Stop sequence ---------- */
	const stopSequence = () => {
		audioEngine.current.stopSequence();
		setPlayheadIndex(null);
		setIsPlaying(false);
	};


	/* ---------- Play chord preview ---------- */
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
				onNoteOn={handleNoteOn}
				onNoteOff={handleNoteOff}
				onNoteClick={handleNoteClick}
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
				playSequence={handlePlaySequence}
				onPreviewChord={handlePreviewChord}
				loop={loop}
				setLoop={setLoop}
				playheadIndex={playheadIndex}
				setPlayheadIndex={setPlayheadIndex}
				instrument={instrument}
				changeInstrument={changeInstrument}
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
