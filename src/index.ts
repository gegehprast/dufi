#!/usr/bin/env node

import { program } from 'commander'
import DuplicateFinder from './DuplicateFinder.js'
import chalk, { ChalkInstance } from 'chalk'
import { select } from '@inquirer/prompts'
import { exec } from 'child_process'
import fs from 'fs'

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

function generateChoices(value: string, color: ChalkInstance, files: string[]) {
    const name: Record<string, string> = {
        keep: 'Keep',
        delete: 'Delete',
        open: 'Open',
    }
    const description: Record<string, string> = {
        keep: `Keep this file and delete the others ${chalk.yellowBright('(WARNING! Will be deleted permanently!)')}`,
        delete: `Delete this file ${chalk.yellowBright('(WARNING! Will be deleted permanently!)')}`,
        open: 'Open this file (Windows only)',
    }

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

async function handleDelete(action: string, files: string[], deleted: string[]) {
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

    console.log(chalk.redBright(`Only Windows is supported for now\n`))
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
    if (iteration % 32 !== 0 && iteration !== total) {
        return
    }

    if (iteration === 1) {
        process.stdout.write('\n')
    }

    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.whiteBright(`[${iteration}/${total}] ${file} (${hash.slice(0, 8)}...)`))
}

program.name('Dufi').description('Find and manage duplicate files').version('0.0.1')

program
    .command('scan <folders...>')
    .option('-e, --extensions <extensions...>', 'filter files by extension', [])
    .option('-b, --bytes <bytes>', 'number of first and last bytes to compare', `${16 * 1024}`)
    .description('scan folders for duplicate files')
    .action(async (folders, options) => {
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

        let currentDuplicateIndex = 0
        let finished = false
        const deleted: string[] = []

        while (!finished) {
            const duplicate = duplicates[currentDuplicateIndex]

            if (!duplicate) break

            const action = await select({
                message: `${currentDuplicateIndex + 1}/${duplicates.length} What do you want to do with these files? ${chalk.yellowBright('(WARNING! Delete operation will delete the file permanently!)')}`,
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
                await handleDelete(action, duplicate.files, deleted)

                currentDuplicateIndex += 1
            } else if (action.startsWith('open_')) {
                handleOpen(action)
            }

            finished = currentDuplicateIndex >= duplicates.length
        }

        console.log(chalk.greenBright.bold(`Done! Deleted ${deleted.length} files.`))
    })

program.parse()

process.on('uncaughtException', (error) => {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.log('Cancelled by user. Press enter to exit...')
    } else {
        // Rethrow unknown errors
        throw error
    }
})
