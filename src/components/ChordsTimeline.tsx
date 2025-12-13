// src/ChordTimeline.tsx
import React, { useEffect, useRef, useState } from "react";
import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
	type DragStart,
} from "@hello-pangea/dnd";
import type { AudioEngine, SoundType } from "../helpers/AudioEngine";
import SoundSelector from "./SoundSelector";
import TimelineControls from "./TimelineControls";
import TransportButtons from "./TransportButtons";

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
	noteToFreq: (note?: string) => number | null; // kept for compatibility
	width: string;
	audioEngine: AudioEngine; // optional: engine passed from parent
};

export default function ChordTimeline({ timeline, setTimeline, width, audioEngine }: Props) {
	const [playingIndex, setPlayingIndex] = useState<number | null>(null);
	const [bpm, setBpm] = useState(128);
	const [loop, setLoop] = useState(true);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const altKeyRef = useRef(false);
	const timeoutRef = useRef<number | null>(null);

	// sound selection (keeps engine and timeline consistent)
	const [sound, setSound] = useState<SoundType>("sine");
	useEffect(() => {
		audioEngine.setSound(sound);
	}, [sound]);


	useEffect(() => {
		if (audioEngine) audioEngine.setBpm(bpm);
	}, [bpm, audioEngine]);

	useEffect(() => {
		const kd = (e: KeyboardEvent) => { altKeyRef.current = e.altKey; };
		const ku = (e: KeyboardEvent) => { altKeyRef.current = e.altKey; };
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
		};
	}, []);

	const playChordAt = (index: number) => {
		const chord = timeline[index];
		if (!chord) return;
		// use audioEngine if available
		if (audioEngine) {
			audioEngine.playChord({ notes: chord.notes, durationBeats: chord.duration ?? 1 });
		} else {
			// fallback: nothing (you had playTone before)
		}
		setPlayingIndex(index);
	};

	const stopSequence = () => {
		if (timeoutRef.current != null) {
			window.clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		if (audioEngine) audioEngine.stopSequence();
		setPlayingIndex(null);
	};

	const playSequence = (start = 0) => {
		if (!timeline.length) return;
		stopSequence();
		if (audioEngine) {
			// convert to AudioChord[] and use engine's sequence
			const audioChords = timeline.map((c) => ({ notes: c.notes, durationBeats: c.duration ?? 1 }));
			audioEngine.playSequence(audioChords, start, loop);
			setPlayingIndex(start);
		} else {
			// fallback scheduling using setTimeout (not recommended)
		}
	};

	const onDragStart = (_start: DragStart) => { };
	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const src = result.source.index;
		const dst = result.destination.index;
		const copied = [...timeline];
		const [moved] = copied.splice(src, 1);
		if (altKeyRef.current) copied.splice(dst, 0, { ...moved, id: crypto.randomUUID() });
		else copied.splice(dst, 0, moved);
		setTimeline(copied);
		altKeyRef.current = false;
	};

	const deleteChord = (index: number) => setTimeline(prev => prev.filter((_, i) => i !== index));

	// native drops (from chord-display / saved-chords)
	const computeInsertIndexFromClientX = (clientX: number) => {
		const container = containerRef.current;
		if (!container) return timeline.length;
		const children = Array.from(container.querySelectorAll("[data-tl-item]")) as HTMLElement[];
		if (!children.length) return 0;
		for (let i = 0; i < children.length; i++) {
			const rect = children[i].getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			if (clientX < midpoint) return i;
		}
		return children.length;
	};

	const handleNativeDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (e.dataTransfer.getData("internal-timeline")) return;
		const data = e.dataTransfer.getData("application/chord") || e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
		if (!data) return;
		try {
			const chord = JSON.parse(data);
			if (!chord?.label || !Array.isArray(chord.notes)) return;
			const idx = computeInsertIndexFromClientX(e.clientX);
			const isDuplicate = e.altKey;
			const newItem: SavedChord = { ...chord, id: crypto.randomUUID(), duration: chord.duration ?? 1, color: chord.color ?? "#666666" };
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
		const missing = timeline.some(c => !c.id);
		if (missing) setTimeline(prev => prev.map(c => (c.id ? c : { ...c, id: crypto.randomUUID() })));
	}, [timeline, setTimeline]);

	return (
		<div className="mt-8 mx-auto flex flex-col gap-3" style={{ width }}>
			<div className="flex items-center w-full gap-4">

				<TransportButtons
					playingIndex={playingIndex}
					timelineLength={timeline.length}
					playSequence={playSequence}
					stopSequence={stopSequence}
				/>

				<div className="ml-4">
					<SoundSelector sound={sound} setSound={setSound} />
				</div>

				<TimelineControls
					bpm={bpm}
					setBpm={setBpm}
					loop={loop}
					setLoop={setLoop}
				/>
			</div>

			<div
				id="timeline"
				className="rounded-lg p-3 bg-gray-900 border border-gray-700"
				onDrop={handleNativeDrop}
				onDragOver={handleNativeDragOver}
			>
				<div className="overflow-x-auto">
					<DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
						<Droppable droppableId="timeline" direction="horizontal">
							{(provided) => (
								<div
									ref={(node) => {
										provided.innerRef(node);
										containerRef.current = node;
									}}
									{...provided.droppableProps}
									className="flex gap-3 items-center min-h-[90px] py-2"
								>
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
														className={`relative px-6 py-6 w-[120px] text-center rounded-xl cursor-pointer text-white select-none transition-transform ${snapshot.isDragging ? "ring-2 ring-blue-400" : ""
															}`}
														style={{
															backgroundColor: bg,
															...drag.draggableProps.style,
														}}
														onClick={() => {
															playChordAt(index);
														}}
													>
														<button
															className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
															onClick={(ev) => {
																ev.stopPropagation();
																deleteChord(index);
															}}
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
		</div>
	);
}
