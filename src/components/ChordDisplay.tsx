// src/ChordDisplay.tsx
import type { AudioEngine } from "../helpers/AudioEngine";

type Props = {
    chord: { label: string; notes: string[] } | null;
    chordName: string;
    audioEngine: AudioEngine;
};

export default function ChordDisplay({ chord, chordName, audioEngine }: Props) {
    return (
        <div
            id="chord-display"
            draggable={!!chord}
            onDragStart={(e) => {
                if (!chord) return;
                e.dataTransfer.setData("application/chord", JSON.stringify(chord));
            }}
            
            onMouseDown={() => {
                // preview chord using audio engine
                if (!chord) return;
                audioEngine.playChord({ notes: chord.notes, durationBeats: 1 });
            }}
            className="mt-4 p-4 bg-green-500 text-white rounded-lg text-2xl font-bold text-center w-full max-w-[300px] shadow-lg cursor-move"
        >
            {chord?.label || chordName}
        </div>
    );
}
