import { createContext, useContext } from "react";

export type AudioUiState = {
    muted: boolean;
    setMuted: React.Dispatch<React.SetStateAction<boolean>>;
};

export const AudioUiContext = createContext<AudioUiState | null>(null);

export function useAudioUi() {
    const ctx = useContext(AudioUiContext);
    if (!ctx) {
        throw new Error("useAudioUi must be used inside AudioUiContext.Provider");
    }
    return ctx;
}
