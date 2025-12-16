// src/components/TransportButtons.tsx
import type { AudioEngine } from "../helpers/AudioEngine";
import RippleButton from "./RippleButton";
import { PlayIcon, StopIcon, RewindIcon, ForwardIcon } from "../icons/TransportIcons";

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
        <div className="flex items-center gap-3 flex-nowrap">
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
                <RewindIcon className="w-5 h-5" />
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
                    audioEngine.stopSequence();
                    setPlayheadIndex(null);
                }}
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
                <ForwardIcon className="w-5 h-5" />
            </RippleButton>

            {/* panic button + label */}
            <div className="flex items-center gap-2 shrink-0">
                <RippleButton
                    onClick={() => {
                        audioEngine.panic();
                        setPlayheadIndex(null);
                    }}
                    className="px-4 py-1 bg-red-900 hover:bg-red-700 rounded text-white font-bold"
                >
                    PANIC
                </RippleButton>

                <span className="text-sm text-gray-400 whitespace-nowrap">
                    (Stops all sound)
                </span>
            </div>
        </div>
    );
}
