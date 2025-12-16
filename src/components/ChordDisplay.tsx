// src/ChordDisplay.tsx
import type { AudioEngine } from "../helpers/AudioEngine";
import { useEffect, useRef, useState } from "react";

type Props = {
    chord: { label: string; notes: string[] } | null;
    chordName: string;
    audioEngine: AudioEngine;
    onCommitChord: (text: string) => boolean;
};

export default function ChordDisplay({ chord, chordName, audioEngine, onCommitChord }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(chordName);
    const inputRef = useRef<HTMLInputElement>(null);

    // keep input in sync when chord changes externally
    useEffect(() => {
        if (!isEditing) {
            setInputValue(chordName);
        }
    }, [chordName, isEditing]);

    // autofocus when entering edit mode
    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const confirmEdit = () => {
        const ok = onCommitChord(inputValue.trim());
        if (ok) {
            setIsEditing(false);
        }
    };
    
    return (
        <div
            id="chord-display"
            draggable={!!chord && !isEditing}
            onDragStart={(e) => {
                if (!chord || isEditing) return;
                e.dataTransfer.setData(
                    "application/chord",
                    JSON.stringify(chord)
                );
            }}
            
            onMouseDown={() => {
                if (!chord) return;
                audioEngine.stopSequence();
                audioEngine.playChord({ notes: chord.notes, durationBeats: 1 });
            }}
            className="mt-4 p-4 bg-green-500 text-white rounded-lg text-2xl font-bold text-center w-full max-w-[300px] shadow-lg cursor-move"
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={confirmEdit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit();
                        if (e.key === "Escape") {
                            setInputValue(chordName);
                            setIsEditing(false);
                        }
                    }}
                    className="w-full bg-white text-black rounded px-2 py-1 text-center outline-none"
                />
            ) : (
                <div onDoubleClick={() => setIsEditing(true)}>
                    {chord?.label || chordName || "—"}
                </div>
            )}
        </div>
    );
}
