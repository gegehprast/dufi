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
                Dufi - Duplicates Manager ({isConnected ? 'Connected' : 'Connecting...'})
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
                                    <div className="w-56 h-56 text-center bg-gray-200">
                                        <p>Preview not available.</p>
                                        <p>Open original file below.</p>
                                    </div>
                                )}

                                <div className="flex flex-row items-center w-full gap-1">
                                    <input
                                        type="text"
                                        value={file.file}
                                        readOnly
                                        className="w-full h-6 p-1 text-xs bg-gray-100 rounded-lg"
                                    />
                                    {/* copy buton */}
                                    <button
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(file.file)

                                            setAlert('Copied to clipboard')
                                            setShowAlert(true)
                                        }}
                                        className="w-10 h-6 p-1 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                                    >
                                        Copy
                                    </button>
                                </div>

                                <div className="flex flex-row items-center justify-center gap-2">
                                    <button
                                        onClick={() => {
                                            socket.emit('open', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                                    >
                                        <span>Open</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('keep', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-green-500 rounded-lg hover:bg-green-600"
                                    >
                                        <span>Keep</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('delete', file.id)
                                        }}
                                        className="w-16 h-6 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600"
                                    >
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

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
