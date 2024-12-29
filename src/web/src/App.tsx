import { useEffect, useReducer, useState } from 'react'
import { socket } from './socket'
import duplicatesReducer, { DuplicateWithPreview } from './duplicatesReducer'

function App() {
    const [isConnected, setIsConnected] = useState(socket.connected)
    const [duplicates, dispatchDuplicates] = useReducer(duplicatesReducer, [])
    const [showAlert, setShowAlert] = useState(false)
    const [alert, setAlert] = useState('')
    const [selectedDupIndex, setSelectedDupIndex] = useState<number>(0)
    const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0)
    const [showHelp, setShowHelp] = useState(true)

    useEffect(() => {
        function onConnect() {
            setIsConnected(true)
        }

        function onDisconnect() {
            setIsConnected(false)
        }

        function onDuplicates(duplicates: DuplicateWithPreview[]) {
            duplicates.forEach((duplicate) => {
                dispatchDuplicates({
                    type: 'added',
                    duplicate,
                })
            })
        }

        function onDuplicate(duplicate: DuplicateWithPreview) {
            dispatchDuplicates({
                type: 'added',
                duplicate,
            })
        }

        function onDeleted(id: number) {
            dispatchDuplicates({
                type: 'deleted',
                id,
            })
        }

        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)
        socket.on('duplicates', onDuplicates)
        socket.on('duplicate', onDuplicate)
        socket.on('deleted', onDeleted)

        return () => {
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
            socket.off('duplicates', onDuplicates)
            socket.off('deleted', onDeleted)
        }
    }, [])

    useEffect(() => {
        const codes = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'KeyA', 'KeyS', 'KeyD']

        function handler(e: KeyboardEvent) {
            if (codes.includes(e.code)) {
                e.preventDefault()
                e.stopPropagation()

                switch (e.code) {
                    case 'ArrowDown':
                        setSelectedDupIndex((prev) => (prev + 1) % duplicates.length)
                        break
                    case 'ArrowUp':
                        setSelectedDupIndex((prev) => (prev - 1 + duplicates.length) % duplicates.length)
                        break
                    case 'ArrowRight':
                        setSelectedFileIndex((prev) => (prev + 1) % duplicates[selectedDupIndex].files.length)
                        break
                    case 'ArrowLeft':
                        setSelectedFileIndex(
                            (prev) =>
                                (prev - 1 + duplicates[selectedDupIndex].files.length) %
                                duplicates[selectedDupIndex].files.length
                        )
                        break
                    case 'KeyA':
                        socket.emit('open', duplicates[selectedDupIndex].files[selectedFileIndex].id)
                        break
                    case 'KeyS':
                        socket.emit('keep', duplicates[selectedDupIndex].files[selectedFileIndex].id)
                        break
                    case 'KeyD':
                        socket.emit('delete', duplicates[selectedDupIndex].files[selectedFileIndex].id)
                        break
                }
            }
        }

        document.addEventListener('keydown', handler)

        return () => {
            document.removeEventListener('keydown', handler)
        }
    }, [duplicates, selectedDupIndex, selectedFileIndex])

    // show duplicate files
    return (
        <div className="p-4 text-white bg-gray-950">
            <h1 className="text-xl font-bold">
                Dufi - Duplicates Manager ({isConnected ? `${duplicates.length} duplicates` : 'Connecting...'})
            </h1>

            {duplicates.map((duplicate, dupIndex) => (
                <div
                    key={dupIndex}
                    className={`p-2 border-b border-gray-700 rounded ${
                        selectedDupIndex === dupIndex ? 'bg-gray-800' : ''
                    }`}
                    onClick={() => setSelectedDupIndex(dupIndex)}
                    ref={(el) => {
                        if (el && selectedDupIndex === dupIndex) {
                            el.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                            })
                        }
                    }}
                >
                    <h2 className="text-xs font-semibold">
                        [{dupIndex + 1}] {duplicate.hash}
                    </h2>

                    <div className="flex flex-row items-center gap-4 p-1 mt-1 overflow-x-auto">
                        {duplicate.files.map((file, fileIndex) => (
                            <div
                                key={fileIndex}
                                className={`flex flex-col items-center gap-2 p-2 border border-gray-700 rounded w-96 ${
                                    selectedDupIndex === dupIndex && selectedFileIndex === fileIndex
                                        ? 'ring-4 ring-blue-600'
                                        : ''
                                }`}
                                onClick={() => setSelectedFileIndex(fileIndex)}
                            >
                                {file.preview ? (
                                    <img
                                        src={file.preview}
                                        alt={file.file}
                                        title={file.file}
                                        className={`object-cover h-56 pointer-events-none select-none ${
                                            file.deleted ? 'grayscale' : ''
                                        }`}
                                    />
                                ) : (
                                    <div
                                        className={`flex items-center justify-center w-56 h-56 text-center bg-blue-100 ${
                                            file.deleted ? 'grayscale' : ''
                                        }`}
                                    >
                                        {file.deleted ? (
                                            <p>File deleted.</p>
                                        ) : (
                                            <div className="text-blue-600">
                                                <p>Preview not available.</p>
                                                <p>Open original file below.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="w-full">
                                    <input
                                        type="text"
                                        value={file.file}
                                        readOnly
                                        className="w-full h-6 p-1 text-xs bg-gray-700 rounded-lg cursor-pointer"
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(file.file)

                                            setAlert('Copied to clipboard')
                                            setShowAlert(true)
                                        }}
                                    />
                                </div>

                                <div
                                    className={`flex flex-row items-center justify-center gap-2 ${
                                        file.deleted ? 'invisible' : ''
                                    }`}
                                >
                                    <button
                                        onClick={() => {
                                            socket.emit('open', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                                        title="Open original file."
                                    >
                                        <span>[a] Open</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('keep', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-green-500 rounded-lg hover:bg-green-600"
                                        title="Keep this file. Delete the others."
                                    >
                                        <span>[s] Keep</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('delete', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600"
                                        title="Delete this file."
                                    >
                                        <span>[d] Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* help */}
            {showHelp && (
                <div className="fixed bottom-0 right-0 p-4">
                    <div className="relative flex flex-col gap-2 p-2 bg-gray-700 border border-gray-700 rounded-lg shadow-lg">
                        {/* header */}
                        <div className="flex flex-row items-center justify-between">
                            <h2 className="font-semibold">How to use</h2>
                            <button
                                className="flex items-center justify-center w-6 h-6 bg-gray-700 rounded-lg hover:bg-gray-800"
                                onClick={() => setShowHelp(false)}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-6 h-6 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h2 className="text-sm font-semibold">What does each button do?</h2>

                            <div>
                                <button
                                    className="w-16 h-6 text-xs text-white bg-blue-500 rounded-lg "
                                    title="Open original file."
                                >
                                    <span>[a] Open</span>
                                </button>
                                <span className="ml-2 text-sm">Open original file.</span>
                            </div>

                            <div>
                                <button
                                    className="w-16 h-6 text-xs text-white bg-green-500 rounded-lg "
                                    title="Keep this file. Delete the others."
                                >
                                    <span>[s] Keep</span>
                                </button>
                                <span className="ml-2 text-sm">Keep one file. Delete the others.</span>
                            </div>

                            <div>
                                <button
                                    className="w-16 h-6 text-xs text-white bg-red-500 rounded-lg "
                                    title="Delete this file."
                                >
                                    <span>[d] Delete</span>
                                </button>
                                <span className="ml-2 text-sm">Delete this file.</span>
                            </div>
                        </div>

                        <div className="p-2 bg-red-500 rounded-lg">
                            <div className="text-sm">
                                Warning! All delete operations are permanent and without confirmation.
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>

                            <p className="text-sm">
                                You can use the <code className="p-1 bg-gray-800">Arrow</code> keys to navigate between
                                duplicates and files. <br />
                                Use the corresponding <code className="p-1 bg-gray-800">a, s, d</code> keys to perform
                                actions.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!showHelp && (
                <div className="fixed bottom-0 right-0 p-4">
                    <button
                        className="w-16 h-6 text-xs text-white bg-gray-700 rounded-lg hover:bg-gray-800"
                        onClick={() => setShowHelp(true)}
                    >
                        <span>Help?</span>
                    </button>
                </div>
            )}

            {/* alert */}
            <div
                className={`transition-all duration-300 fixed -translate-x-1/2 top-4 left-1/2 ${
                    showAlert ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none -translate-y-[20px]'
                } `}
                onTransitionEnd={() => {
                    if (!showAlert) return

                    setTimeout(() => {
                        setShowAlert(false)
                    }, 1000)
                }}
            >
                <div className="flex flex-row items-center gap-2 p-2 text-white bg-green-500 rounded-lg">
                    <span>{alert}</span>
                </div>
            </div>
        </div>
    )
}

export default App
