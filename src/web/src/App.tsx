import { useEffect, useReducer, useState } from 'react'
import { socket } from './socket'
import duplicatesReducer, { DuplicateWithPreview } from './duplicatesReducer'

function App() {
    const [isConnected, setIsConnected] = useState(socket.connected)
    const [duplicates, dispatchDuplicates] = useReducer(duplicatesReducer, [])
    const [showAlert, setShowAlert] = useState(false)
    const [alert, setAlert] = useState('')

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

    // show duplicate files
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold">
                Dufi - Duplicates Manager ({isConnected ? `${duplicates.length} duplicates` : 'Connecting...'})
            </h1>

            {duplicates.map((duplicate, index) => (
                <div key={index} className="pb-2 mt-2 border-b hover:bg-slate-50">
                    <h2 className="text-xs font-semibold">
                        [{index + 1}] {duplicate.hash}
                    </h2>

                    <div className="flex flex-row items-center gap-4 overflow-x-auto">
                        {duplicate.files.map((file, index) => (
                            <div key={index} className="flex flex-col items-center gap-2 p-2 border w-96">
                                {file.preview ? (
                                    <img
                                        src={file.preview}
                                        alt={file.file}
                                        title={file.file}
                                        className={`object-cover h-56 ${file.deleted ? 'grayscale' : ''}`}
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
                                        className="w-full h-6 p-1 text-xs bg-gray-100 rounded-lg cursor-pointer"
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
                                        <span>Open</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('keep', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-green-500 rounded-lg hover:bg-green-600"
                                        title="Keep this file. Delete the others."
                                    >
                                        <span>Keep</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('delete', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600"
                                        title="Delete this file."
                                    >
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="fixed bottom-0 right-0 p-4">
                <div className="flex flex-col gap-2 p-4 bg-white border rounded-lg shadow-lg">
                    <div>What do each button does?</div>

                    <div>
                        <button
                            className="w-16 h-6 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                            title="Open original file."
                        >
                            <span>Open</span>
                        </button>
                        <span className="ml-2">Open original file.</span>
                    </div>

                    <div>
                        <button
                            className="w-16 h-6 text-xs text-white bg-green-500 rounded-lg hover:bg-green-600"
                            title="Keep this file. Delete the others."
                        >
                            <span>Keep</span>
                        </button>
                        <span className="ml-2">Keep one file. Delete the others.</span>
                    </div>

                    <div>
                        <button
                            className="w-16 h-6 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600"
                            title="Delete this file."
                        >
                            <span>Delete</span>
                        </button>
                        <span className="ml-2">Delete this file.</span>
                    </div>

                    {/* warnig */}
                    <div className="text-sm text-red-500">
                        Warning! All delete operations are permanent and without confirmation.
                    </div>
                </div>
            </div>

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
