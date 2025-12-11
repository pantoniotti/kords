import React from "react";

interface KeyboardProps {
	visibleKeys: string[];
	visibleWhiteKeys: string[];
	blackKeyPositions: { note: string; leftPosition: number }[];
	activeNotes: string[];
	toggleNote: (note: string) => void;
	whiteKeyWidth: number;
}

const Keyboard: React.FC<KeyboardProps> = ({
	visibleKeys,
	visibleWhiteKeys,
	blackKeyPositions,
	activeNotes,
	toggleNote,
	whiteKeyWidth
}) => {
	return (
		<div className="w-full flex flex-col items-center">
			<div id="keyboard-wrapper" className="p-4 bg-gray-800 rounded-xl shadow-lg">
				<div
					className="relative mx-auto"
					style={{
						width: `${visibleWhiteKeys.length * whiteKeyWidth}px`,
						height: "200px"
					}}
				>
					{/* WHITE KEYS */}
					<div className="flex">
						{visibleWhiteKeys.map(note => (
							<div
								key={note}
								onClick={() => toggleNote(note)}
								className={`
									w-[48px]
									h-[192px]
									border border-gray-300 rounded-b-lg
									relative z-0 cursor-pointer
									transition shadow-md
									${activeNotes.includes(note) ? "bg-blue-400" : "bg-white"}
								`}
							/>
						))}
					</div>

					{/* BLACK KEYS */}
					{blackKeyPositions.map(({ note, leftPosition }) => (
						<div
							key={note}
							onClick={() => toggleNote(note)}
							className={`
								w-[32px]
								h-[128px]
								absolute top-0 z-10
								rounded-b-md cursor-pointer
								transition shadow-2xl
								${activeNotes.includes(note) ? "bg-blue-800" : "bg-black"}
							`}
							style={{ left: `${leftPosition}px`, top: 0 }}
						/>
					))}
				</div>
			
				<div className="mt-4 w-full flex items-center justify-between">
					<div className="p-2 bg-gray-700 text-white rounded text-center w-full sm:w-[48%]">
						Octaves: {visibleKeys[0]?.slice(-1)} – {visibleKeys[visibleKeys.length - 1]?.slice(-1)}
					</div>

					<div className="p-2 bg-gray-700 text-white rounded text-center w-full sm:w-[48%]">
						Notes: {activeNotes.join(" • ") || ""}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Keyboard;