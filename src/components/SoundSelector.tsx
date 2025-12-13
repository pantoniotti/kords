// src/SoundSelector.tsx
import type { SoundType } from "../helpers/AudioEngine";

type Props = {
    sound: SoundType;
    setSound: (s: SoundType) => void;
};

export default function SoundSelector({ sound, setSound }: Props) {
    return (
        <div className="flex items-center gap-3 w-full justify-end">
            <div className="flex items-center gap-2">
                <label className="text-white">Sound:</label>
                <select
                    value={sound}
                    onChange={(e) => setSound(e.target.value as SoundType)}
                    className="px-2 rounded bg-gray-800 text-white border border-gray-600"
                >
                    <option value="sine">Sine</option>
                    <option value="sawtooth">Sawtooth</option>
                    <option value="fm-piano">FM Piano</option>
                    <option value="pad">Pad</option>
                </select>
            </div>
        </div>
    );
}
