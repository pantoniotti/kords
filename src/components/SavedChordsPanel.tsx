type SavedChord = {
	label: string;      // visible chord name
	notes: string[];    // hidden actual MIDI notes
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
	noteToFreq
}: Props) {

	return (
		<div className="mt-6 p-4 bg-gray-900 rounded-xl shadow-lg w-full max-w-[700px]">
			<h2 className="text-white text-lg font-semibold mb-3">Saved Chords</h2>

			{/* DROP ZONE */}
			<div
				onDragOver={(e) => {
					e.preventDefault();
					e.currentTarget.classList.add("ring-2", "ring-blue-400");
				}}
				onDragLeave={(e) => {
					e.currentTarget.classList.remove("ring-2", "ring-blue-400");
				}}
				onDrop={(e) => {
					e.preventDefault();
					e.currentTarget.classList.remove("ring-2", "ring-blue-400");

					const json =
						e.dataTransfer.getData("application/chord") ||
						e.dataTransfer.getData("application/json");

					if (!json) return;

					try {
						const chord = JSON.parse(json);

						// chord { label: string, notes: number[] }
						if (chord?.label && Array.isArray(chord.notes)) {
							setSavedChords((prev) => [...prev, chord]);
						}
					} catch { }
				}}
				className="
                    min-h-[150px]
                    border-2 border-dashed border-gray-600
                    rounded-lg
                    flex flex-wrap justify-center items-start gap-3
                    p-4
                    transition-all
                "
			>

				{/* SAVED CHORDS */}
				{savedChords.map((chord, i) => (
					<div
						key={i}
						className="relative px-6 py-4 bg-gray-700 text-white rounded-lg shadow cursor-pointer hover:bg-gray-600"
					>
						{/* DELETE BUTTON */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								setSavedChords((prev) =>
									prev.filter((_, idx) => idx !== i)
								);
							}}
							className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
						>
							✕
						</button>

						{/* RECALL CHORD */}
						<div
							onClick={() => {
								setActiveNotes(chord.notes);
								chord.notes.forEach(n =>
									playTone(noteToFreq(n), 0.8)
								);
							}}
						>
							{chord.label}
						</div>

						{/* Hidden notes for later use */}
						<div className="hidden">
							{JSON.stringify(chord.notes)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}