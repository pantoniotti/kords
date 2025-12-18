// src/KordApp.tsx
import { useEffect, useRef, useState } from "react";
import { detect as detectChord } from "@tonaljs/chord-detect";
import { Chord, Note, Midi } from "@tonaljs/tonal";

import { AudioEngine, type InstrumentId } from "../helpers/AudioEngine";
import Keyboard from "./Keyboard";
import ChordTimeline from "./ChordsTimeline";
import ChordImportExport from "./ChordImportExport";
import ChordDisplay from "./ChordDisplay";
import { AudioHelper } from "../helpers/AudioHelper";
import { AudioUiContext } from "../context/AudioUiContext";

const BEATS_PER_BAR = 4;
const BASE_OCTAVE_DEFAULT = 3;

/* ---------- helpers ---------- */
function sortNotesByPitch(notes: string[]) {
	return [...notes].sort((a, b) => {
		const ma = Note.midi(a);
		const mb = Note.midi(b);
		if (ma == null || mb == null) return 0;
		return ma - mb;
	});
}

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(pointer: coarse)");
		setIsMobile(mq.matches);
	}, []);
	return isMobile;
}

/* ---------- component ---------- */
export default function KordApp() {
	/* ---------- state ---------- */
	const [currentChordNotes, setCurrentChordNotes] = useState<string[]>([]);
	const [chordName, setChordName] = useState("—");
	const [baseOctave, setBaseOctave] = useState(BASE_OCTAVE_DEFAULT);
	const [savedChords, setSavedChords] = useState<any[]>([]);
	const [loop, setLoop] = useState(false);
	const [playheadIndex, setPlayheadIndex] = useState<number | null>(null);
	const [keyboardWidth, setKeyboardWidth] = useState<number>(0);
	const [soundReady, setSoundReady] = useState(false);
	const [instrument, setInstrument] = useState<InstrumentId>("acoustic_grand_piano");
	const [isPlaying, setIsPlaying] = useState(false);
	const [uiLocked, setUiLocked] = useState(false);
	const [muted, setMuted] = useState(false);


	/* ---------- refs ---------- */
	// audio engine
	const audioEngine = useRef(new AudioEngine(120, "sine"));
	// notes currently physically held down (keyboard + MIDI)
	const pressedNotes = useRef<Set<string>>(new Set());
	// sound ready flag
	const soundReadyRef = useRef(false);
	// lock to prevent UI interactions (e.g., during import/export)
	const uiLockedRef = useRef(false);
	/* ---------- mobile detection ---------- */
	const isMobile = useIsMobile();

	/* ---------- change instrument ---------- */
	const changeInstrument = async (id: InstrumentId) => {
		await audioEngine.current.loadSoundfont(id);

		if (id.includes("pad")) audioEngine.current.setReleaseTime(1.2);
		else if (id.includes("string")) audioEngine.current.setReleaseTime(0.8);
		else audioEngine.current.setReleaseTime(0.25);

		setInstrument(id);
	};

	/* ----------- transpose notes ------------*/
	function transposeNotes(notes: string[], semitones: number): string[] {
		return notes
			.map(n => {
				const midi = Note.midi(n);
				if (midi == null) return null;
				return Note.fromMidi(midi + semitones);
			})
			.filter(Boolean) as string[];
	}

	/* ----------- use effects ------------*/
	useEffect(() => {
		audioEngine.current.setMuted(muted);
	}, [muted]);
	
	/* ---------- spacebar transport ---------- */
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (uiLockedRef.current) return;          // 🔒 block transport
			if (e.repeat) return;

			if (e.code === "Space") {
				e.preventDefault();
				if (isMobile) return;
				if (isPlaying) stopSequence();
				else handlePlaySequence(0);
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isPlaying, savedChords, loop, uiLocked]);


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

	/* ---------- uiLocked ref sync ---------- */
	useEffect(() => {
		uiLockedRef.current = uiLocked;
	}, [uiLocked]);

	/* ---------- MIDI support ---------- */
	useEffect(() => {
		if (!navigator.requestMIDIAccess) {
			console.warn("Web MIDI not supported");
			return;
		}

		let midi: MIDIAccess | null = null;

		const onMidiMessage = (e: MIDIMessageEvent) => {
			if (!soundReadyRef.current) return;
			if (uiLockedRef.current) return;

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

	/* ---------- 	Chord edit ---------- */
	const handleChordTextCommit = (text: string) => {
		const parsed = Chord.get(text);

		// invalid chord
		if (!parsed || !parsed.notes.length) {
			console.log("invalid chord:", text);
			return false;
		}

		// 1️⃣ Voice chord (adds octaves)
		const voiced = AudioHelper.voiceChord(parsed.notes, baseOctave);

		// 2️⃣ Normalize enharmonics (Bb → A#)
		const notes = AudioHelper.normalizeSharps(voiced);

		setCurrentChordNotes(notes);
		setChordName(parsed.symbol || text);

		audioEngine.current.stopSequence();
		audioEngine.current.playChord({ notes, durationBeats: 1 });

		return true;
	};

	/* ---------- Keyboard press ---------- */
	const handleNoteOn = (note: string) => {
		if (!soundReadyRef.current) return;
		if (uiLockedRef.current) return;

		// already held → ignore (important for polyphony)
		if (pressedNotes.current.has(note)) return;

		pressedNotes.current.add(note);

		// 🎼 commit chord visually
		const chord = sortNotesByPitch(Array.from(pressedNotes.current));
		setCurrentChordNotes(chord);

		const matches = detectChord(chord);
		setChordName(matches.length ? matches[0] : "—");

		// 🔊 audio: play ONLY this note
		audioEngine.current.playNote(note);
	};

	/* ---------- Keyboard release ---------- */
	const handleNoteOff = (note: string) => {
		if (!soundReadyRef.current) return;
		if (uiLockedRef.current) return;

		if (!pressedNotes.current.has(note)) return;

		pressedNotes.current.delete(note);

		// 🔊 audio only
		audioEngine.current.stopNote(note);
	};

	/* ---------- Transpose Chord ---------- */
	const handleTransposeChord = (semitones: number) => {
		if (!currentChordNotes.length) return;

		const transposed = sortNotesByPitch(
			transposeNotes(currentChordNotes, semitones)
		);
		const normalized = AudioHelper.normalizeSharps(transposed);

		setCurrentChordNotes(normalized);

		const matches = detectChord(normalized);
		setChordName(matches.length ? matches[0] : "—");

		// optional preview (short)
		audioEngine.current.playChord({
			notes: normalized,
			durationBeats: 0.5,
		});
	};

	/* ---------- Mouse click ---------- */
	const handleNoteClick = (note: string) => {
		if (!soundReadyRef.current) return;
		if (uiLockedRef.current) return;

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
		if (uiLockedRef.current) return;

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
		<div className="min-h-screen bg-gray-900 text-white">
			<div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 flex flex-col gap-4 overflow-x-hidden items-center">
				{/* <h1 className="text-3xl font-bold mb-6">🎹 Chord Tool</h1> */}
				<h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-6">
					🎹 Chord Tool
				</h1>

				{!soundReady && (
					<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
						<button className="px-6 py-4 text-lg sm:text-xl bg-green-500 rounded-xl w-full max-w-xs">
							Tap to enable audio
						</button>
					</div>
				)}

				<AudioUiContext.Provider value={{ muted, setMuted }}>
					<Keyboard
						baseOctave={baseOctave}
						setBaseOctave={setBaseOctave}
						activeNotes={currentChordNotes}
						onNoteOn={handleNoteOn}
						onNoteOff={handleNoteOff}
						onNoteClick={handleNoteClick}
						onWidthChange={setKeyboardWidth}
						disabled={!soundReady || uiLocked}
						isMobile={isMobile}
					/>

					<ChordDisplay
						chord={currentChord}
						chordName={chordName}
						audioEngine={audioEngine.current}
						onCommitChord={handleChordTextCommit}
						onTranspose={handleTransposeChord}
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
							setUiLocked={setUiLocked}
							/>
					</div>
				</AudioUiContext.Provider>
			</div>
		</div>
	);
}
