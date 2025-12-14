// src/ChordTimeline.tsx
import { useEffect, useRef, useState } from "react";
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

/* ---------- types ---------- */
export type SavedChord = {
	label: string;
	notes: string[];
	id?: string;
	duration?: number;
	color?: string;
};

type Props = {
	timeline: SavedChord[];
	setTimeline: (
		updater: SavedChord[] | ((p: SavedChord[]) => SavedChord[])
	) => void;

	width: number;
	audioEngine: AudioEngine;

	playSequence: () => void;
	onPreviewChord: (chord: SavedChord) => void;

	loop: boolean;
	setLoop: (v: boolean) => void;

	playheadIndex: number | null;
	setPlayheadIndex: any
};

/* ---------- component ---------- */
export default function ChordTimeline({
	timeline,
	setTimeline,
	width,
	audioEngine,
	playSequence,
	onPreviewChord,
	loop,
	setLoop,
	playheadIndex,
	setPlayheadIndex
}: Props) {

	/* ---------- local state ---------- */
	const [bpm, setBpm] = useState(128);
	const [sound, setSound] = useState<SoundType>("sine");

	const containerRef = useRef<HTMLDivElement | null>(null);
	const altKeyRef = useRef(false);

	/* ---------- engine sync ---------- */
	useEffect(() => {
		audioEngine.setSound(sound);
	}, [sound, audioEngine]);

	useEffect(() => {
		audioEngine.setBpm(bpm);
	}, [bpm, audioEngine]);

	/* ---------- alt-key tracking ---------- */
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			altKeyRef.current = e.altKey;
		};
		window.addEventListener("keydown", onKey);
		window.addEventListener("keyup", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("keyup", onKey);
		};
	}, []);

	/* ---------- drag & drop ---------- */
	const onDragStart = (_: DragStart) => { };

	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return;

		const src = result.source.index;
		const dst = result.destination.index;

		setTimeline(prev => {
			const copy = [...prev];
			const [moved] = copy.splice(src, 1);
			copy.splice(
				dst,
				0,
				altKeyRef.current ? { ...moved, id: crypto.randomUUID() } : moved
			);
			return copy;
		});

		altKeyRef.current = false;
	};

	const deleteChord = (index: number) =>
		setTimeline(prev => prev.filter((_, i) => i !== index));

	/* ---------- native drops ---------- */
	const computeInsertIndexFromClientX = (clientX: number) => {
		const container = containerRef.current;
		if (!container) return timeline.length;

		const items = Array.from(
			container.querySelectorAll("[data-tl-item]")
		) as HTMLElement[];

		for (let i = 0; i < items.length; i++) {
			const rect = items[i].getBoundingClientRect();
			if (clientX < rect.left + rect.width / 2) return i;
		}
		return items.length;
	};

	const handleNativeDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (e.dataTransfer.getData("internal-timeline")) return;

		const raw =
			e.dataTransfer.getData("application/chord") ||
			e.dataTransfer.getData("application/json") ||
			e.dataTransfer.getData("text/plain");

		if (!raw) return;

		try {
			const chord = JSON.parse(raw);
			if (!chord?.label || !Array.isArray(chord.notes)) return;

			const index = computeInsertIndexFromClientX(e.clientX);

			const newChord: SavedChord = {
				...chord,
				id: crypto.randomUUID(),
				duration: chord.duration ?? 1,
				color: chord.color ?? "#4b5563",
			};

			setTimeline(prev => {
				const copy = [...prev];
				copy.splice(index, 0, newChord);
				return copy;
			});
		} catch { }
	};

	/* ---------- ensure IDs ---------- */
	useEffect(() => {
		if (timeline.some(c => !c.id)) {
			setTimeline(prev =>
				prev.map(c => (c.id ? c : { ...c, id: crypto.randomUUID() }))
			);
		}
	}, [timeline, setTimeline]);

	/* ---------- render ---------- */
	return (
		<div className="mt-8 mx-auto flex flex-col gap-3" style={{ width }}>
			<div className="flex items-center gap-4">

				<TransportButtons
					playheadIndex={playheadIndex}
					timelineLength={width}
					playSequence={playSequence}
					audioEngine={audioEngine}
					setPlayheadIndex={setPlayheadIndex}
				/>

				<SoundSelector sound={sound} setSound={setSound} />

				<TimelineControls
					bpm={bpm}
					setBpm={setBpm}
					loop={loop}
					setLoop={setLoop}
				/>
			</div>

			<div
				className="rounded-lg p-5 bg-gray-900 border border-gray-700"
				onDrop={handleNativeDrop}
				onDragOver={e => e.preventDefault()}
			>
				<div className="overflow-x-auto">
					<DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
						<Droppable droppableId="timeline" direction="horizontal">
							{provided => (
								<div
									ref={node => {
										provided.innerRef(node);
										containerRef.current = node;
									}}
									{...provided.droppableProps}
									className="flex gap-3 items-center min-h-[90px] py-2"
								>
									{timeline.length === 0 && (
										<div className="text-gray-500 italic mx-auto">
											Drop your chords here…
										</div>
									)}

									{timeline.map((chord, index) => {
										const isPlaying = playheadIndex === index;

										return (
											<Draggable
												key={chord.id!}
												draggableId={chord.id!}
												index={index}
											>
												{drag => (
													<div
														ref={drag.innerRef}
														{...drag.draggableProps}
														{...drag.dragHandleProps}
														data-tl-item
														className={`
															relative px-6 py-6 w-[120px] rounded-xl cursor-pointer
															text-white select-none align-center flex items-center justify-center
															${isPlaying ? "ring-2 ring-white scale-105" : ""}
														`}
														style={{
															backgroundColor: chord.color ?? "#4b5563",
															...drag.draggableProps.style,
															marginLeft: index === 0 ? 12 : 0,
														}}
														onMouseDown={e => {
															e.preventDefault();
															// Stop any running sequence
															audioEngine.stopSequence();
															// Mark this chord as selected
															setPlayheadIndex(index);
															// Play it + update keyboard / display
															onPreviewChord(chord);
														}}

													>
														<button
															className="absolute -top-1 -right-1 bg-red-600 rounded-full w-6 h-6 text-xs"
															onClick={e => {
																e.stopPropagation();
																deleteChord(index);
															}}
														>
															✕
														</button>

														<div className="font-semibold">
															{chord.label}
														</div>
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
