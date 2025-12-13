// src/components/TransportButtons.tsx
import type { AudioEngine } from "../helpers/AudioEngine";
import RippleButton from "./RippleButton";
import { SkipBack, Play, Square, SkipForward } from "lucide-react";

type Props = {
    playheadIndex: number | null;
    timelineLength: number;
    playSequence: (start?: number) => void;
    audioEngine: AudioEngine;
};

export default function TransportButtons({
    playheadIndex,
    timelineLength,
    playSequence,
    audioEngine,
}: Props) {
    return (
        <div className="flex items-center gap-3">
            <RippleButton
                className="bg-gray-700 hover:bg-gray-600 rounded-xl"
                onClick={() => {
                    audioEngine.stopSequence();
                    playSequence(
                        playheadIndex != null
                            ? Math.max(playheadIndex - 1, 0)
                            : 0
                    );
                }}
            >
                <SkipBack size={20} />
            </RippleButton>

            <RippleButton
                className="bg-green-500 hover:bg-green-400 rounded-xl"
                onClick={() => {
                    audioEngine.stopSequence();
                    playSequence(playheadIndex ?? 0);
                }}
            >
                <Play size={20} />
            </RippleButton>

            <RippleButton
                className="bg-red-600 hover:bg-red-500 rounded-xl"
                onClick={audioEngine.stopSequence.bind(audioEngine)}
            >
                <Square size={20} />
            </RippleButton>

            <RippleButton
                className="bg-gray-700 hover:bg-gray-600 rounded-xl"
                onClick={() => {
                    audioEngine.stopSequence();
                    playSequence(
                        playheadIndex == null
                            ? 0
                            : Math.min(playheadIndex + 1, timelineLength - 1)
                    );
                }}
            >
                <SkipForward size={20} />
            </RippleButton>

            <button
                onClick={() => {
                    audioEngine.panic();
                }}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-white font-bold"
            >
                STOP
            </button>
        </div>
    );
}
