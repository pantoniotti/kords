import { useEffect, useState } from "react";

type ChordImportExportProps = {
    savedChords: any[];
    setSavedChords: (chords: any[]) => void;
    setUiLocked: (v: boolean) => void;
};

export default function ChordImportExport({
    savedChords,
    setSavedChords,
    setUiLocked
}: ChordImportExportProps) {

    const [isExporting, setIsExporting] = useState(false);
    const [filename, setFilename] = useState("saved_chords");

    /* ---------- lock ui while exporting ---------- */
    useEffect(() => {
        setUiLocked(isExporting);
    }, [isExporting]);

    const confirmExport = () => {
        const safeName = filename.endsWith(".json")
            ? filename
            : `${filename}.json`;

        const blob = new Blob(
            [JSON.stringify(savedChords, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = safeName;
        a.click();
        URL.revokeObjectURL(url);

        setIsExporting(false);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        file.text().then(content => {
            try {
                const parsed = JSON.parse(content);
                if (!Array.isArray(parsed)) return;

                const validChords = parsed.filter(ch =>
                    ch &&
                    typeof ch === "object" &&
                    typeof ch.label === "string" &&
                    Array.isArray(ch.notes)
                );

                if (validChords.length > 0) {
                    setSavedChords(validChords);
                }
            } catch {
                /* ignore invalid JSON */
            }
        });
    };

    return (
        <div className="mt-4 flex flex-wrap items-center gap-3">

            {!isExporting && (
                <>
                    {/* EXPORT */}
                    <button
                        onClick={() => setIsExporting(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition"
                    >
                        Export
                    </button>

                    {/* IMPORT */}
                    <input
                        type="file"
                        accept="application/json"
                        id="importFile"
                        className="hidden"
                        onChange={handleImport}
                    />
                    <label
                        htmlFor="importFile"
                        className="px-4 py-2 bg-purple-600 text-white rounded-md shadow cursor-pointer hover:bg-purple-700 transition"
                    >
                        Import
                    </label>
                </>
            )}

            {isExporting && (
                <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg border border-gray-700">
                    <input
                        autoFocus
                        type="text"
                        value={filename}
                        onChange={e => setFilename(e.target.value)}
                        className="px-3 py-2 rounded-md bg-gray-900 text-white border border-gray-600 focus:outline-none focus:ring"
                    />

                    <button
                        onClick={confirmExport}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                        Save
                    </button>

                    <button
                        onClick={() => setIsExporting(false)}
                        className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
