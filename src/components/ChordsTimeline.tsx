import { useEffect, useRef, useState } from "react";
import RippleButton from "./RippleButton";
import { AudioEngine, type SoundType, type Chord as AudioChord } from "../helpers/AudioEngine";
import { SkipBack, Play, Square, SkipForward } from "lucide-react";

import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
	type DragStart,
} from "@hello-pangea/dnd";

type SavedChord = {
	label: string;
	notes: string[];
	id?: string;
	duration?: number;
	color?: string;
};

type Props = {
	timeline: SavedChord[];
	setTimeline: (updater: SavedChord[] | ((p: SavedChord[]) => SavedChord[])) => void;
	noteToFreq: (note?: string) => number | null;
	width: string;
};

export default function ChordTimeline({ timeline, setTimeline, width }: Props) {
	const [playingIndex, setPlayingIndex] = useState<number | null>(null);
	const [bpm, setBpm] = useState(128);
	const [globalSound, setGlobalSound] = useState<SoundType>("piano");
	const [loop, setLoop] = useState<boolean>(true);

	const containerRef = useRef<HTMLDivElement | null>(null);
	const altKeyRef = useRef(false);

	// Initialize AudioEngine
	const audioEngineRef = useRef<AudioEngine>(new AudioEngine(bpm, loop));
	useEffect(() => audioEngineRef.current.setBpm(bpm), [bpm]);
	useEffect(() => audioEngineRef.current.setSound(globalSound), [globalSound]);
	useEffect(() => audioEngineRef.current.setLoop(loop), [loop]);

	// Alt key tracking for duplication
	useEffect(() => {
		const kd = (e: KeyboardEvent) => altKeyRef.current = e.altKey;
		const ku = (e: KeyboardEvent) => altKeyRef.current = e.altKey;
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
		};
	}, []);

	// Play a single chord
	const playChordAt = (index: number) => {
		const chord = timeline[index];
		if (!chord) return;
		const audioChord: AudioChord = { notes: chord.notes, durationBeats: chord.duration ?? 1 };
		audioEngineRef.current.playChord(audioChord);
		setPlayingIndex(index);
	};

	// Play full sequence
	const playSequence = (startIndex = 0) => {
		if (!timeline.length) return;
		const audioChords: AudioChord[] = timeline.map(c => ({
			notes: c.notes,
			durationBeats: c.duration ?? 1,
		}));
		audioEngineRef.current.playSequence(audioChords, startIndex);
		setPlayingIndex(startIndex);
	};

	const stopSequence = () => {
		audioEngineRef.current.stopSequence();
		setPlayingIndex(null);
	};

	const onDragStart = (_start: DragStart) => { };
	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return;

		const src = result.source.index;
		const dst = result.destination.index;

		const copied = [...timeline];
		const [moved] = copied.splice(src, 1);

		if (altKeyRef.current) {
			const dup = { ...moved, id: crypto.randomUUID() };
			copied.splice(dst, 0, dup);
		} else {
			copied.splice(dst, 0, moved);
		}

		setTimeline(copied);
		altKeyRef.current = false;
	};

	const deleteChord = (index: number) => {
		setTimeline(prev => prev.filter((_, i) => i !== index));
	};

	// Compute insertion index for native drops (accurate snapping)
	const computeInsertIndexFromClientX = (clientX: number) => {
		const container = containerRef.current;
		if (!container) return timeline.length;

		const children = Array.from(container.querySelectorAll("[data-tl-item]")) as HTMLElement[];
		if (!children.length) return 0;

		for (let i = 0; i < children.length; i++) {
			const el = children[i];
			const rect = el.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			if (clientX < midpoint) return i;
		}

		return children.length;
	};

	const handleNativeDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (e.dataTransfer.getData("internal-timeline")) return;

		const data = e.dataTransfer.getData("application/chord") || e.dataTransfer.getData("application/json");
		if (!data) return;

		try {
			const chord = JSON.parse(data);
			if (!chord?.label || !Array.isArray(chord.notes)) return;

			const idx = computeInsertIndexFromClientX(e.clientX);
			const isDuplicate = e.altKey;

			const newItem: SavedChord = {
				...chord,
				id: crypto.randomUUID(),
				duration: chord.duration ?? 1,
				color: chord.color ?? "#666666",
			};

			setTimeline(prev => {
				const copy = [...prev];
				if (!isDuplicate) {
					const existingIndex = prev.findIndex(c => c.id === chord.id);
					if (existingIndex >= 0) copy.splice(existingIndex, 1);
				}
				copy.splice(idx, 0, newItem);
				return copy;
			});
		} catch { }
	};

	const handleNativeDragOver = (e: React.DragEvent) => e.preventDefault();

	useEffect(() => {
		// Ensure every chord has an ID
		const missing = timeline.some(c => !c.id);
		if (missing) {
			setTimeline(prev => prev.map(c => (c.id ? c : { ...c, id: crypto.randomUUID() })));
		}
	}, [timeline]);

	return (
		<div className="mt-8 mx-auto flex flex-col gap-3" style={{ width }}>
			{/* Controls */}
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-3">
					<RippleButton className="bg-gray-700 hover:bg-gray-600 rounded-xl" onClick={() => { stopSequence(); playSequence(playingIndex != null ? Math.max(playingIndex - 1, 0) : 0); }}>
						<SkipBack size={20} />
					</RippleButton>

					<RippleButton className="bg-green-500 hover:bg-green-400 rounded-xl" onClick={() => { stopSequence(); playSequence(playingIndex ?? 0); }}>
						<Play size={20} />
					</RippleButton>

					<RippleButton className="bg-red-600 hover:bg-red-500 rounded-xl" onClick={stopSequence}>
						<Square size={20} />
					</RippleButton>

					<RippleButton className="bg-gray-700 hover:bg-gray-600 rounded-xl" onClick={() => { stopSequence(); playSequence(playingIndex == null ? 0 : Math.min(playingIndex + 1, timeline.length - 1)); }}>
						<SkipForward size={20} />
					</RippleButton>
				</div>

				{/* Right side: BPM + Sound + Loop */}
				<div className="flex items-center gap-4 ml-auto text-white">
					<div className="flex items-center gap-2">
						<label>BPM:</label>
						<input type="number" min={20} max={300} value={bpm} onChange={e => setBpm(Number(e.target.value) || 1)}
							className="w-16 px-2 rounded bg-gray-800 text-white border border-gray-600" />
					</div>

					<div className="flex items-center gap-2">
						<label>Sound:</label>
						<select value={globalSound} onChange={e => setGlobalSound(e.target.value as SoundType)}
							className="px-2 rounded bg-gray-800 text-white border border-gray-600">
							<option value="piano">Piano</option>
							<option value="synth">Synth</option>
							<option value="organ">Organ</option>
						</select>
					</div>

					<div className="flex items-center gap-2">
						<label>Loop:</label>
						<input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} />
					</div>
				</div>
			</div>

			{/* Timeline */}
			<div id="timeline" className="rounded-lg p-3 bg-gray-900 border border-gray-700"
				onDrop={handleNativeDrop} onDragOver={handleNativeDragOver}>
				<DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
					<Droppable droppableId="timeline" direction="horizontal">
						{provided => (
							<div ref={node => { provided.innerRef(node); containerRef.current = node; }}
								{...provided.droppableProps}
								className="flex gap-3 overflow-x-auto items-center min-h-[90px] p-2">
								{timeline.length === 0 && (
									<div className="text-gray-500 text-sm italic opacity-70 mx-auto py-6 select-none pointer-events-none">
										Drop your chords here…
									</div>
								)}

								{timeline.map((chord, index) => {
									const id = chord.id ?? index.toString();
									const bg = chord.color ?? "#4b5563";

									return (
										<Draggable key={id} draggableId={id} index={index}>
											{(drag, snapshot) => (
												<div
													ref={drag.innerRef}
													{...drag.draggableProps}
													{...drag.dragHandleProps}
													data-tl-item
													style={{ ...drag.draggableProps.style, backgroundColor: bg }}
													className={`
														relative px-6 py-6 min-w-[110px] text-center rounded-xl cursor-pointer text-white select-none
														${playingIndex === index ? "ring-4 ring-green-400" : ""}
														${snapshot.isDragging ? "ring-2 ring-blue-400 scale-105" : ""}
													`}
													onClick={() => { stopSequence(); playChordAt(index); }}
												>
													<button
														className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
														onClick={ev => { ev.stopPropagation(); deleteChord(index); }}
													>
														✕
													</button>

													<div className="font-semibold">{chord.label}</div>
												</div>
											)}
										</Draggable>
									);
								})}

								{provided.placeholder}
							</div>
						)}
					</Droppable>
				</DragDropContext>
			</div>
		</div>
	);
}
