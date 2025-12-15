// src/components/TransportButtons.tsx
import type { AudioEngine } from "../helpers/AudioEngine";
import RippleButton from "../atoms/RippleButton";
import { SkipBack, Play, Square, SkipForward } from "lucide-react";
import { PlayIcon, StopIcon } from "./icons/TransportIcons";

type Props = {
    playheadIndex: number | null;
    timelineLength: number;
    playSequence: (start?: number) => void;
    audioEngine: AudioEngine;
    setPlayheadIndex: any;
};

export default function TransportButtons({
    playheadIndex,
    timelineLength,
    playSequence,
    audioEngine,
    setPlayheadIndex
}: Props) {
    return (
        <div className="flex items-center gap-3">
            {/* rewind button */}
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

            {/* play button */}
            <RippleButton
                className="bg-green-500 hover:bg-green-400 rounded-xl"
                onClick={() => {
                    audioEngine.stopSequence();
                    playSequence(playheadIndex ?? 0);
                }}
            >
                <PlayIcon className="w-5 h-5" />
            </RippleButton>

            {/* stop button */}
            <RippleButton
                className="bg-red-600 hover:bg-red-500 rounded-xl"
                onClick={() => {
                        audioEngine.stopSequence()
                        setPlayheadIndex(null);
                    }
                }
            >
                <StopIcon className="w-5 h-5" />
            </RippleButton>

            {/* forward button */}
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

            {/* panic button */}
            <RippleButton
                onClick={() => {
                    audioEngine.panic();
                    setPlayheadIndex(null);
                }}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-white font-bold"
            >
                PANIC
            </RippleButton>
        </div>
    );
}
