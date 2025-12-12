import { useEffect } from "react";
import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
} from "@hello-pangea/dnd";

type SavedChord = {
	label: string;
	notes: string[];
	id?: string; // stable id
};

type Props = {
	savedChords: SavedChord[];
	setSavedChords: (fn: (prev: SavedChord[]) => SavedChord[]) => void;
	setActiveNotes: (notes: string[]) => void;
	playTone: (freq: number, volume: number) => void;
	noteToFreq: (note: string) => number | null;
};

export default function SavedChordsPanel({
	savedChords,
	setSavedChords,
	setActiveNotes,
	playTone,
	noteToFreq,
}: Props) {
	// Ensure stable IDs
	useEffect(() => {
		const missing = savedChords.some((c) => !c.id);
		if (missing) {
			setSavedChords((prev) =>
				prev.map((c) => (c.id ? c : { ...c, id: crypto.randomUUID() }))
			);
		}
	}, [savedChords, setSavedChords]);

	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const src = result.source.index;
		const dst = result.destination.index;
		const altPressed = result.combine ? true : result.reason === "DROP"; // optional: detect Alt differently if needed

		setSavedChords((prev) => {
			const copy = [...prev];
			const chord = copy[src];

			if (altPressed) {
				// duplicate at new position
				copy.splice(dst, 0, { ...chord, id: crypto.randomUUID() });
			} else {
				// move
				copy.splice(src, 1);
				copy.splice(dst, 0, chord);
			}
			return copy;
		});
	};

	const deleteChord = (index: number) => {
		setSavedChords((prev) => prev.filter((_, i) => i !== index));
	};

	return (
		<div className="mt-6 p-4 bg-gray-900 rounded-xl shadow-lg w-full max-w-[1100px] hidden">
			<h2 className="text-white font-semibold mb-2"></h2>

			<DragDropContext onDragEnd={onDragEnd}>
				<Droppable droppableId="saved-chords" direction="horizontal">
					{(provided) => (
						<div
							ref={provided.innerRef}
							{...provided.droppableProps}
							className="flex flex-wrap gap-3 p-2 min-h-[60px] border-2 border-dashed border-gray-600 rounded-lg"
						>
							{savedChords.map((chord, i) => (
								<Draggable key={chord.id!} draggableId={chord.id!} index={i}>
									{(drag, snapshot) => (
										<div
											ref={drag.innerRef}
											{...drag.draggableProps}
											{...drag.dragHandleProps}
											className={`relative px-6 py-4 rounded-lg cursor-move text-white select-none
                  							${snapshot.isDragging ? "ring-2 ring-blue-400 scale-105" : "bg-gray-700 hover:bg-gray-600"}`}
										>
											<button
												onClick={(ev) => {
													ev.stopPropagation();
													deleteChord(i);
												}}
												className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
											>
												✕
											</button>

											<div
												onClick={() => {
													setActiveNotes(chord.notes);
													chord.notes.forEach((n) => {
														const freq = noteToFreq(n);
														if (freq !== null) playTone(freq, 0.8);
													});
												}}
												className="font-semibold text-center"
											>
												{chord.label}
											</div>
										</div>
									)}
								</Draggable>
							))}
							{provided.placeholder}
						</div>
					)}
				</Droppable>
			</DragDropContext>
		</div>
	);
}
