import EventEmitter from 'events'
import { Duplicate } from './DuplicateFinder.js'
import fs from 'fs'

const IMAGE_EXTENSIONS = ['.apng', '.png', '.avif', '.gif', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.png', '.svg', '.webp']

export type DuplicateWithPreview = {
    hash: string
    files: {
        original: string
        preview: string | null
    }[]
}

export interface DuplicateManager {
    
}

export class DuplicateManager extends EventEmitter {
    public duplicates: DuplicateWithPreview[] = []

    constructor(duplicates: Duplicate[]) {
        super()

        this.duplicates = this.generatePreview(duplicates)
    }

    private generatePreview(duplicates: Duplicate[]) {
        return duplicates.map((duplicate) => {
            return {
                hash: duplicate.hash,
                files: duplicate.files.map((file) => {
                    return {
                        original: file,
                        preview: this.generatePreviewPath(file),
                    }
                }),
            }
        })
    }

    private generatePreviewPath(file: string) {
        // check if file is an image
        const ext = file.split('.').pop()?.toLowerCase()

        if (ext && IMAGE_EXTENSIONS.includes(`.${ext}`)) {
            return this.imagePreview(file)
        }

        return null
    }

    private imagePreview(file: string) {
        // convert image to base64
        const data = fs.readFileSync(file)

        return `data:image/png;base64,${data.toString('base64')}`
    }
}

export default DuplicateManager
