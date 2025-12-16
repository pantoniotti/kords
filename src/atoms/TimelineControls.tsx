// src/components/TimelineControls.tsx
type Props = {
    bpm: number;
    setBpm: (v: number) => void;
    loop: boolean;
    setLoop: (v: boolean) => void;
};

export default function TimelineControls({ bpm, setBpm, loop, setLoop }: Props) {
    return (
        <div className="ml-auto flex items-center gap-4 text-white">

            {/* BPM */}
            <div className="flex items-center gap-2">
                <label className="text-white">BPM:</label>
                <input
                    type="number"
                    min={20}
                    max={300}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value) || 1)}
                    className="w-16 px-2 rounded bg-gray-800 text-white border border-gray-600"
                />
            </div>

            {/* Loop */}
            <div className="flex items-center gap-2">
                <label className="text-white">Loop:</label>
                <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                />
            </div>
        </div>
    );
}
