type SavedChord = {
    label: string;
    notes: string[];
};

type Props = {
    chord: SavedChord | null;
    chordName: string;
    activeNotes: string[];
    playTone: (freq: number, volume?: number) => void;
    noteToFreq: (note: string) => number | null;
};

export default function ChordDisplay({
    chord,
    chordName,
    activeNotes,
    playTone,
    noteToFreq,
}: Props) {
    return (
        <div
            id="chord-display"
            draggable={!!chord}
            onDragStart={(e) => {
                if (!chord) return;
                // Use explicit MIME type so drop targets can parse it
                e.dataTransfer.setData("application/chord", JSON.stringify(chord));
            }}
            onClick={() =>
                activeNotes.forEach((n) => {
                    const freq = noteToFreq(n);
                    if (freq !== null) playTone(freq, 1);
                })
            }
            className="mt-8 p-4 bg-green-500 text-white rounded-lg text-2xl font-bold text-center w-full max-w-[300px] shadow-lg cursor-move"
        >
            {chordName}
        </div>
    );
}
