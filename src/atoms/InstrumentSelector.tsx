// src/components/InstrumentSelector.tsx
import type { InstrumentId } from "../helpers/AudioEngine";
import { MuteButton } from "./MuteButton";

type Props = {
    current: string;
    onChange: (id: InstrumentId) => void;
};

const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
    { id: "acoustic_grand_piano", label: "Piano" },
    { id: "electric_piano_1", label: "EP 1" },
    { id: "electric_piano_2", label: "EP 2" },
    { id: "string_ensemble_1", label: "Strings" },
    { id: "pad_2_warm", label: "Warm Pad" },
    { id: "pad_1_new_age", label: "New Age Pad" },
    { id: "choir_aahs", label: "Choir" },
];

export default function InstrumentSelector({ current, onChange }: Props) {
    return (
        <div className="flex items-center gap-3 w-full justify-end">
            <div className="flex items-center gap-2"></div>
            <label className="text-white">Sound:</label>
            <select
                value={current}
                onChange={(e) => onChange(e.target.value as InstrumentId)}
                className="px-2 rounded bg-gray-800 text-white border border-gray-600"
            >
                {INSTRUMENTS.map(i => (
                    <option key={i.id} value={i.id}>
                        {i.label}
                    </option>
                ))}
            </select>
            <MuteButton />
        </div>
    );
}
