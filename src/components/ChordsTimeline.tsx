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
import TimelineControls from "../atoms/TimelineControls";
import TransportButtons from "../atoms/TransportButtons";
import InstrumentSelector from "../atoms/InstrumentSelector";
import { PlayIcon, StopIcon, TrashIcon } from "../icons/TransportIcons";

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
	const manualPlayIndexRef = useRef<number | null>(null);


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
															relative px-6 py-7 w-[120px] rounded-xl cursor-pointer
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
															manualPlayIndexRef.current = null;
															setPlayheadIndex(index);
														}}
													>
														{/* 🗑️ Trash button */}
														<button
															className="
																absolute bottom-1 left-1
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

														{/* ▶️ / ⏹ Play button */}
														<button
															className="
															absolute bottom-1 right-1
															p-1 rounded-md
															text-white/70
															hover:text-white hover:bg-white/20
															transition
														"
															onMouseDown={e => {
																e.stopPropagation();
																e.preventDefault();
															}}
															onClick={e => {
																e.stopPropagation();

																if (isPlaying && manualPlayIndexRef.current === index) {
																	audioEngine.stopSequence();
																	manualPlayIndexRef.current = null;
																	setPlayheadIndex(null);
																} else {
																	audioEngine.stopSequence();
																	manualPlayIndexRef.current = index;
																	setPlayheadIndex(index);
																	audioEngine.playChord(
																		{
																			notes: chord.notes,
																			durationBeats: chord.duration ?? 1,
																		},
																		() => {
																			manualPlayIndexRef.current = null;
																			setPlayheadIndex(null);
																		}
																	);
																	onPreviewChord(chord);
																}
															}}
														>
															{isPlaying && manualPlayIndexRef.current === index ? (
																<StopIcon className="w-4 h-4" />
															) : (
																<PlayIcon className="w-4 h-4" />
															)}
														</button>
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
