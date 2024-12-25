export type DuplicateWithPreview = {
    hash: string
    files: {
        id: number
        file: string
        preview: string | null
        deleted: boolean
    }[]
}

type DuplicatesActions =
    | {
          type: 'added'
          duplicate: DuplicateWithPreview
      }
    | {
          type: 'deleted'
          id: number
      }

export default function duplicatesReducer(duplicates: DuplicateWithPreview[], action: DuplicatesActions) {
    switch (action.type) {
        case 'added': {
            const existing = duplicates.find((duplicate) => duplicate.hash === action.duplicate.hash)

            if (existing) {
                return [
                    ...duplicates.map((duplicate) =>
                        duplicate.hash === action.duplicate.hash ? action.duplicate : duplicate
                    ),
                ]
            }

            return [...duplicates, action.duplicate]
        }
        case 'deleted': {
            return duplicates.map((duplicate) => {
                const file = duplicate.files.find((file) => file.id === action.id)

                if (file) {
                    return {
                        ...duplicate,
                        files: duplicate.files.map((file) =>
                            file.id === action.id ? { ...file, deleted: true } : file
                        ),
                    }
                }

                return duplicate
            })
        }
    }
}
