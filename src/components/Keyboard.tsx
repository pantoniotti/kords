import { useEffect, useRef } from "react";

/* ---------- keyboard layout ---------- */
const KEYS = [
	"C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1",
	"C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2",
	"C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
	"C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
	"C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
	"C6"
];

const BASE_KEYBOARD: Record<string, string> = {
	a: "C", w: "C#", s: "D", e: "D#", d: "E",
	f: "F", t: "F#", g: "G", y: "G#", h: "A", u: "A#", j: "B"
};

const EXTRA_KEYBOARD: Record<string, string> = {
	i: "C", k: "C#", o: "D", l: "D#", p: "E"
};

const DESKTOP_KEY_WIDTH = 48;
const MOBILE_KEY_WIDTH = 32;
const VISIBLE_KEYS_COUNT = 37;

/* ---------- helpers ---------- */
function getNoteFromKey(key: string, octave: number) {
	if (BASE_KEYBOARD[key]) return BASE_KEYBOARD[key] + octave;
	if (EXTRA_KEYBOARD[key]) return EXTRA_KEYBOARD[key] + (octave + 1);
	return null;
}

/* ---------- props ---------- */
type Props = {
	baseOctave: number;
	setBaseOctave: (o: number) => void;
	activeNotes: string[];
	onNoteOn: (note: string) => void;
	onNoteOff: (note: string) => void;
	onNoteClick: (note: string) => void;
	onWidthChange?: (width: number) => void;
	disabled?: boolean;
	isMobile?: boolean;
};

export default function Keyboard({
	baseOctave,
	setBaseOctave,
	activeNotes,
	onNoteOn,
	onNoteOff,
	onNoteClick,
	onWidthChange,
	disabled,
	isMobile
}: Props) {

	const whiteKeyWidth = isMobile ? MOBILE_KEY_WIDTH : DESKTOP_KEY_WIDTH;
	const keyboardHeight = isMobile ? 140 : 200;
	const blackKeyHeight = isMobile ? 90 : 128;
	const blackKeyOffsetMap: Record<string, number> = { C: 32, D: 30, F: 30, G: 30, A: 30 };

	const scrollRef = useRef<HTMLDivElement | null>(null);

	/* ---------- visible keys ---------- */
	const startIndex = Math.min(
		Math.max(0, KEYS.findIndex(k => parseInt(k.slice(-1)) === baseOctave)),
		KEYS.length - VISIBLE_KEYS_COUNT
	);
	const visibleKeys = KEYS.slice(startIndex, startIndex + VISIBLE_KEYS_COUNT);
	const visibleWhiteKeys = visibleKeys.filter(k => !k.includes("#"));

	const blackKeys = visibleKeys
		.filter(k => k.includes("#"))
		.map(key => {
			const pred = KEYS[KEYS.indexOf(key) - 1];
			const idx = visibleWhiteKeys.indexOf(pred);
			const offset = blackKeyOffsetMap[pred?.[0]];
			return idx >= 0 && offset !== undefined ? { note: key, left: idx * whiteKeyWidth + offset } : null;
		})
		.filter(Boolean) as { note: string, left: number }[];

	/* ---------- computer keyboard ---------- */
	useEffect(() => {
		if (isMobile) return;

		const down = (e: KeyboardEvent) => {
			if (e.key === "z") return setBaseOctave(Math.max(1, baseOctave - 1));
			if (e.key === "x") return setBaseOctave(Math.min(4, baseOctave + 1));
			const note = getNoteFromKey(e.key.toLowerCase(), baseOctave);
			if (note) onNoteOn(note);
		};
		const up = (e: KeyboardEvent) => {
			const note = getNoteFromKey(e.key.toLowerCase(), baseOctave);
			if (note) onNoteOff(note);
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
	}, [baseOctave, isMobile]);

	/* ---------- scroll buttons (desktop) ---------- */
	// const scrollAmount = whiteKeyWidth * 5; // 5 keys at a time
	// const scrollLeft = () => { scrollRef.current?.scrollBy({ left: -scrollAmount, behavior: "smooth" }); };
	// const scrollRight = () => { scrollRef.current?.scrollBy({ left: scrollAmount, behavior: "smooth" }); };

	// Replace the scroll buttons handlers with:
	const scrollLeft = () => {
		setBaseOctave(Math.max(1, baseOctave - 1));
	};

	const scrollRight = () => {
		setBaseOctave(Math.min(6, baseOctave + 1));
	};


	/* ---------- width observer ---------- */
	const rootRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!rootRef.current || !onWidthChange) return;
		const update = () => onWidthChange(rootRef.current!.offsetWidth);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(rootRef.current);
		return () => ro.disconnect();
	}, [onWidthChange]);

	/* ---------- render ---------- */
	return (
		<div
			ref={rootRef}
			className="p-4 bg-gray-800 rounded-xl shadow-lg flex flex-col gap-2"
			style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.5 : 1 }}
		>
			{/* Scrollable keyboard */}
			<div ref={scrollRef} className="overflow-x-auto touch-pan-x scrollbar-hide mx-auto">
				<div className="relative" style={{ width: visibleWhiteKeys.length * whiteKeyWidth, height: keyboardHeight }}>
					{/* White keys */}
					<div className="flex">
						{visibleWhiteKeys.map(note => {
							const isActive = activeNotes.includes(note);
							return (
								<div
									key={note}
									onPointerDown={() => onNoteClick(note)}
									className={`relative border border-gray-300 rounded-b-lg cursor-pointer ${isActive ? "bg-blue-400" : "bg-white"}`}
									style={{ width: whiteKeyWidth, height: keyboardHeight - 8 }}
								>
									<span className="absolute bottom-1 w-full text-center text-gray-400 text-xs select-none">{note}</span>
								</div>
							);
						})}
					</div>

					{/* Black keys */}
					{blackKeys.map(({ note, left }) => {
						const isActive = activeNotes.includes(note);
						return (
							<div
								key={note}
								onPointerDown={() => onNoteClick(note)}
								className={`absolute top-0 z-10 rounded-b-md cursor-pointer shadow-2xl ${isActive ? "bg-blue-800" : "bg-black"}`}
								style={{ width: 32, left, height: blackKeyHeight }}
							/>
						);
					})}
				</div>
			</div>

			{/* Footer info */}
			<div className="flex flex-col sm:flex-row gap-2 mt-2">
				<div className="p-2 bg-gray-700 text-white rounded text-center w-full sm:w-1/2">
					{/* Desktop scroll buttons */}
					{!isMobile && (
						<div className="flex justify-between mb-1">
							<button onClick={scrollLeft} className="px-3 py-0 bg-gray-700 rounded text-white">◀</button>
							Octave: {baseOctave}
							<button onClick={scrollRight} className="px-3 py-0 bg-gray-700 rounded text-white">▶</button>
						</div>
					)}
				</div>
				<div className="p-2 bg-gray-700 text-white rounded text-center w-full sm:w-1/2">
					Notes: {activeNotes.join(" • ") || ""}
				</div>
			</div>
		</div>
	);
}
