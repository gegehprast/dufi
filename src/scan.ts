import DuplicateFinder from './DuplicateFinder.js'
import chalk, { ChalkInstance } from 'chalk'
import { select } from '@inquirer/prompts'
import { exec } from 'child_process'
import fs from 'fs'
import server from './server.js'
import DuplicateManager from './DuplicateManager.js'

function genId(index: number) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const alphabetLength = alphabet.length

    if (index <= alphabetLength) {
        return alphabet[index]
    }

    const firstChar = alphabet[index % alphabetLength]
    const secondChar = Math.ceil(index / alphabetLength)

    return `${firstChar}${secondChar}`
}

const name = {
    keep: 'Keep',
    delete: 'Delete',
    open: 'Open',
}
const description: Record<keyof typeof name, string> = {
    keep: `Keep this file and delete the others ${chalk.yellowBright('(WARNING! Will be deleted permanently!)')}`,
    delete: `Delete this file ${chalk.yellowBright('(WARNING! Will be deleted permanently!)')}`,
    open: 'Open this file (Windows only)',
}

function generateChoices(value: keyof typeof name, color: ChalkInstance, files: string[]) {
    return files.map((file, i) => ({
        name: color(`[${genId(i)}] ${name[value]} ${file}`),
        description: description[value],
        value: `${value}_${file}`,
    }))
}

async function handleKeep(action: string, files: string[], deleted: string[]) {
    const file = action.replace('keep_', '')
    const otherFiles = files.filter((f) => f !== file)

    for (const otherFile of otherFiles) {
        try {
            fs.unlinkSync(otherFile)

            deleted.push(otherFile)
        } catch (error: any) {
            console.error(chalk.redBright(`Error deleting ${otherFile}: ${error.message}\n`))
        }
    }

    console.log(chalk.greenBright(`Keeping ${file}\n`))
}

async function handleDelete(action: string, deleted: string[]) {
    const file = action.replace('delete_', '')

    try {
        fs.unlinkSync(file)

        deleted.push(file)

        console.log(chalk.redBright(`Deleted ${file}\n`))
    } catch (error: any) {
        console.error(chalk.redBright(`Error deleting ${file}: ${error.message}\n`))
    }
}

function handleOpen(action: string) {
    const file = action.replace('open_', '')

    // detect user OS
    const isWindows = process.platform === 'win32'

    if (isWindows) {
        exec(`start "" "${file}"`)

        console.log(chalk.blueBright(`Opening ${file}\n`))

        return
    }

    console.log(chalk.redBright(`Only Windows is supported!\n`))
}

function handleScan(folder: string) {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.whiteBright(`Scanning ${folder}...`))
}

function handleScanResult(folder: string, files: string[]) {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.whiteBright(`Found ${files.length} files in ${folder}`))
}

function handleFiles(files: string[]) {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.whiteBright(`Found ${files.length} files`))
}

function handleProgress(iteration: number, total: number, file: string, hash: string) {
    if (iteration % 32 !== 0 && iteration !== total) return

    if (iteration === 1) {
        process.stdout.write('\n')
    }

    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.whiteBright(`[${iteration}/${total}] ${file} (${hash.slice(0, 8)}...)`))
}

function openBrowser() {
    const isWindows = process.platform === 'win32'
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'

    if (isWindows) {
        // try open Edge first
        exec('start microsoft-edge:http://localhost:1234', (error) => {
            if (!error) return

            exec('start http://localhost:1234', (error) => {
                if (!error) return

                console.error(chalk.redBright('Error opening browser! Please open http://localhost:1234 manually.'))
            })
        })
    } else if (isMac) {
        exec('open http://localhost:1234')
    } else if (isLinux) {
        exec('xdg-open http://localhost:1234')
    }

    console.log(chalk.blueBright('Opening browser...'))
}

export default async function scan(folders: string[], options: { web: boolean, extensions: string[]; bytes: string }) {
    // scan files
    const startTime = Date.now()
    const finder = new DuplicateFinder({
        folders: folders,
        extensions: options.extensions,
        bytes: parseInt(options.bytes),
    })

    finder.on('scan', handleScan)
    finder.on('scan-result', handleScanResult)
    finder.on('files', handleFiles)
    finder.on('progress', handleProgress)

    const duplicates = await finder.run()
    const endTime = Date.now()

    console.log(chalk.greenBright.bold(`\nFound ${duplicates.length} duplicates in ${((endTime - startTime) / 1000).toFixed(2)}s\n`))

    if (options.web) {
        // start web server
        console.log(chalk.blueBright('Starting web server...'))

        const manager = new DuplicateManager(duplicates)

        await server(manager)
        
        openBrowser()

        return
    }

    // start interactive management
    let currentDuplicateIndex = 0
    let finished = false
    const deleted: string[] = []

    while (!finished) {
        const duplicate = duplicates[currentDuplicateIndex]

        if (!duplicate) break

        const action = await select({
            message: `${currentDuplicateIndex + 1}/${duplicates.length} ${chalk.blueBright(duplicate.hash)} 
            \nWhat do you want to do with these files? ${chalk.yellowBright('(WARNING! Delete operation will delete the file permanently!)')}\n`,
            choices: [
                { name: chalk.blueBright('Skip'), description: 'Skip this duplicates', value: 'skip' },
                ...generateChoices('keep', chalk.greenBright, duplicate.files),
                ...generateChoices('delete', chalk.redBright, duplicate.files),
                ...generateChoices('open', chalk.blueBright, duplicate.files),
            ],
            default: 'skip',
            pageSize: 30,
        })

        if (action === 'skip') {
            console.log(chalk.yellowBright('Skipped...\n'))

            currentDuplicateIndex += 1
        } else if (action.startsWith('keep_')) {
            await handleKeep(action, duplicate.files, deleted)

            currentDuplicateIndex += 1
        } else if (action.startsWith('delete_')) {
            await handleDelete(action, deleted)

            currentDuplicateIndex += 1
        } else if (action.startsWith('open_')) {
            handleOpen(action)
        }

        finished = currentDuplicateIndex >= duplicates.length
    }

    console.log(chalk.greenBright.bold(`Done! Deleted ${deleted.length} files.`))
}
