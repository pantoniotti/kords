import { useAudioUi } from "../context/AudioUiContext";

export function MuteButton() {
    const { muted, setMuted } = useAudioUi();

    return (
        <button
            onClick={() => setMuted(m => !m)}
            className={`
            px-3 py-2 rounded-md text-sm font-medium
            ${muted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"}
        `}
        >
            {muted ? "🔇 Muted" : "🔊 Sound"}
        </button>
    );
}