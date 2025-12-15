// src/ChordTimeline.tsx
import { useEffect, useRef, useState } from "react";

import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
	type DragStart,
} from "@hello-pangea/dnd";

import type { AudioEngine, InstrumentId, SoundType } from "../helpers/AudioEngine";
import TimelineControls from "./TimelineControls";
import TransportButtons from "./TransportButtons";
import InstrumentSelector from "./InstrumentSelector";


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
	setPlayheadIndex: any;
	instrument: InstrumentId;
	changeInstrument: (id: InstrumentId) => void;
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
	setPlayheadIndex,
	instrument,
	changeInstrument
}: Props) {

	/* ---------- local state ---------- */
	const [bpm, setBpm] = useState(128);
	const [sound, _setSound] = useState<SoundType>("sine");

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

	/* ---------- ensure IDs ---------- */
	useEffect(() => {
		if (timeline.some(c => !c.id)) {
			setTimeline(prev =>
				prev.map(c => (c.id ? c : { ...c, id: crypto.randomUUID() }))
			);
		}
	}, [timeline, setTimeline]);
	
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

	const TrashIcon = ({ className = "" }) => (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
			<path d="M10 11v6" />
			<path d="M14 11v6" />
			<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
		</svg>
	);


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

				{/* <SoundSelector sound={sound} setSound={setSound} /> */}

				<InstrumentSelector
					current={instrument}
					onChange={changeInstrument}
				/>

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
											<Draggable key={chord.id!} draggableId={chord.id!} index={index}>
												{drag => (
													<div
														ref={drag.innerRef}
														{...drag.draggableProps}
														{...drag.dragHandleProps}
														data-tl-item
														className={`
				relative px-6 py-6 w-[120px] rounded-xl cursor-pointer
				text-white select-none flex items-center justify-center
				transition
				${isPlaying ? "ring-2 ring-white scale-105" : ""}
			`}
														style={{
															backgroundColor: chord.color ?? "#4b5563",
															...drag.draggableProps.style,
															marginLeft: index === 0 ? 12 : 0,
														}}
														onMouseDown={e => {
															e.preventDefault();
															audioEngine.stopSequence();
															setPlayheadIndex(index);
															onPreviewChord(chord);
														}}
													>
														{/* 🗑️ Trash button */}
														<button
															className="
					absolute bottom-2 left-2
					p-1 rounded-md
					text-white/70
					hover:text-white hover:bg-white/20
					transition
					pointer-events-auto
				"
															onMouseDown={e => {
																e.stopPropagation(); // 🚫 prevent chord play
																e.preventDefault();
															}}
															onClick={e => {
																e.stopPropagation();
																deleteChord(index);
															}}
														>
															<TrashIcon className="w-4 h-4" />
														</button>

														{/* Label */}
														<div className="font-semibold pointer-events-none">
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
