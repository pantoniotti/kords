// src/components/TransportButtons.tsx
import RippleButton from "./RippleButton";
import { SkipBack, Play, Square, SkipForward } from "lucide-react";

type Props = {
    playingIndex: number | null;
    timelineLength: number;
    playSequence: (start?: number) => void;
    stopSequence: () => void;
};

export default function TransportButtons({
    playingIndex,
    timelineLength,
    playSequence,
    stopSequence,
}: Props) {
    return (
        <div className="flex items-center gap-3">
            <RippleButton
                className="bg-gray-700 hover:bg-gray-600 rounded-xl"
                onClick={() => {
                    stopSequence();
                    playSequence(
                        playingIndex != null
                            ? Math.max(playingIndex - 1, 0)
                            : 0
                    );
                }}
            >
                <SkipBack size={20} />
            </RippleButton>

            <RippleButton
                className="bg-green-500 hover:bg-green-400 rounded-xl"
                onClick={() => {
                    stopSequence();
                    playSequence(playingIndex ?? 0);
                }}
            >
                <Play size={20} />
            </RippleButton>

            <RippleButton
                className="bg-red-600 hover:bg-red-500 rounded-xl"
                onClick={stopSequence}
            >
                <Square size={20} />
            </RippleButton>

            <RippleButton
                className="bg-gray-700 hover:bg-gray-600 rounded-xl"
                onClick={() => {
                    stopSequence();
                    playSequence(
                        playingIndex == null
                            ? 0
                            : Math.min(playingIndex + 1, timelineLength - 1)
                    );
                }}
            >
                <SkipForward size={20} />
            </RippleButton>
        </div>
    );
}
