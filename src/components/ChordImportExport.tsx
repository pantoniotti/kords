type ChordImportExportProps = {
    savedChords: any[]; // Replace 'any' with your chord type if available
    setSavedChords: (chords: any[]) => void; // Replace 'any' with your chord type if available
};

export default function ChordImportExport({ savedChords, setSavedChords }: ChordImportExportProps) {
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(savedChords, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "saved_chords.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then((content) => {
            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) setSavedChords(parsed);
            } catch {
                // ignore invalid files
            }
        });
    };

    return (
        <div id="chord-import-export" className="mt-4 flex flex-wrap items-center gap-4">
            {/* EXPORT */}
            <button
                onClick={handleExport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition-colors duration-200"
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
                className="px-4 py-2 bg-purple-600 text-white rounded-md shadow cursor-pointer hover:bg-purple-700 transition-colors duration-200"
            >
                Import
            </label>
        </div>
    );
}
