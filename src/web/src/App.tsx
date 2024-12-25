import { useEffect, useReducer, useState } from 'react'
import { socket } from './socket'
import duplicatesReducer, { DuplicateWithPreview } from './duplicatesReducer'

function App() {
    const [isConnected, setIsConnected] = useState(socket.connected)
    const [duplicates, dispatchDuplicates] = useReducer(duplicatesReducer, [])

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
                Dufi - Duplicates Manager ({isConnected ? 'Connected' : 'Disconnected'})
            </h1>

            {duplicates.map((duplicate, index) => (
                <div key={index} className="pb-2 mt-4 border-b hover:bg-slate-50">
                    <h2 className="font-semibold">{duplicate.hash}</h2>

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
                                    <button
                                        onClick={() => {
                                            window.open(file.file, '_blank')
                                        }}
                                        rel="noreferrer"
                                        className={`p-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 ${
                                            file.deleted ? 'grayscale' : ''
                                        }`}
                                        disabled={file.deleted}
                                    >
                                        Load Preview
                                    </button>
                                )}

                                <div className="w-full">
                                    <input
                                        type="text"
                                        value={file.file}
                                        readOnly
                                        className="w-full p-2 bg-gray-100 rounded-lg"
                                    />
                                </div>

                                <div className="flex flex-row items-center justify-center gap-2">
                                    <button
                                        onClick={() => {
                                            socket.emit('keep', file.id)
                                        }}
                                        className="w-20 p-1 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                                    >
                                        Keep
                                    </button>

                                    <button
                                        onClick={() => {
                                            socket.emit('delete', file.id)
                                        }}
                                        className="w-20 p-1 text-white bg-red-500 rounded-lg hover:bg-red-600"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default App
