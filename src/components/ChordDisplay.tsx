// src/ChordDisplay.tsx
import type { AudioEngine } from "../helpers/AudioEngine";
import { useEffect, useRef, useState } from "react";

type Props = {
    chord: { label: string; notes: string[] } | null;
    chordName: string;
    audioEngine: AudioEngine;
    onCommitChord: (text: string) => boolean;
    onTranspose: (semitones: number) => void;
};

export default function ChordDisplay({ chord, chordName, audioEngine, onCommitChord, onTranspose  }: Props) {
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
        <div className="flex items-stretch gap-2">
            {/* LEFT BUTTONS */}
            <div className="flex flex-col">
                <button
                    onClick={() => onTranspose(-1)}
                    className="flex-1 px-2 bg-gray-700 rounded-b text-center"
                >
                    -1
                </button>
                <button
                    onClick={() => onTranspose(-12)}
                    className="flex-1 px-2 bg-gray-700 rounded-t text-center"
                >
                    -12
                </button>
            </div>

            {/* CENTER DISPLAY (UNCHANGED LOGIC) */}
            <div
                id="chord-display"
                className="flex items-center justify-center px-4 py-2 bg-gray-800 rounded text-lg min-w-[120px]"
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
            >
                {isEditing ? (
                    <input
                        id="chord-edit"
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
                        className="bg-gray-700 text-white w-full text-center"
                    />
                ) : (
                    <div onDoubleClick={() => setIsEditing(true)}>
                        {chord?.label || chordName || "—"}
                    </div>
                )}
            </div>

            {/* RIGHT BUTTONS */}
            <div className="flex flex-col">
                <button
                    onClick={() => onTranspose(1)}
                    className="flex-1 px-2 bg-gray-700 rounded-t text-center"
                >
                    +1
                </button>
                <button
                    onClick={() => onTranspose(12)}
                    className="flex-1 px-2 bg-gray-700 rounded-b text-center"
                >
                    +12
                </button>
            </div>
        </div>
    );
}
