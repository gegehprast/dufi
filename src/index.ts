#!/usr/bin/env node

import { program } from 'commander'
import DuplicateFinder from './DuplicateFinder.js'
import chalk from 'chalk'
import { select } from '@inquirer/prompts'
import { exec } from 'child_process'
import trash from 'trash'

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
        const duplicates = await finder.run()
        const endTime = Date.now()

        console.log(chalk.greenBright.bold(`Found ${duplicates.length} duplicates in ${((endTime - startTime) / 1000).toFixed(2)}s\n`))

        let currentDuplicateIndex = 0
        let finished = false
        const deleted = []

        while (!finished) {
            const duplicate = duplicates[currentDuplicateIndex]

            const action = await select({
                message: `${currentDuplicateIndex + 1}/${duplicates.length} What do you want to do with these files?`,
                choices: [
                    { name: chalk.blueBright('Skip'), description: 'Skip this duplicates', value: 'skip' },
                    ...duplicate.files.map((file, i) => ({
                        name: chalk.greenBright(`[${genId(i)}] Keep ${file}`),
                        description: 'Keep this file and delete the others',
                        value: `keep_${file}`,
                    })),
                    ...duplicate.files.map((file, i) => ({
                        name: chalk.redBright(`[${genId(i)}] Delete ${file}`),
                        description: 'Delete this file and keep the others',
                        value: `delete_${file}`,
                    })),
                    ...duplicate.files.map((file, i) => ({
                        name: chalk.blueBright(`[${genId(i)}] Open ${file}`),
                        description: 'Open this file or its folder',
                        value: `open_${file}`,
                    })),
                ],
                default: 'skip',
                loop: false,
            })

            if (action === 'skip') {
                console.log(chalk.yellowBright('Skipped...\n'))

                currentDuplicateIndex += 1
            } else if (action.startsWith('keep_')) {
                const file = action.replace('keep_', '')
                const otherFiles = duplicate.files.filter((f) => f !== file)

                for (const otherFile of otherFiles) {
                    deleted.push(otherFile)
                    await trash(otherFile)
                }

                currentDuplicateIndex += 1

                console.log(chalk.greenBright(`Keeping ${file}\n`))
            } else if (action.startsWith('delete_')) {
                const file = action.replace('delete_', '')

                deleted.push(file)
                await trash(file)
                currentDuplicateIndex += 1

                console.log(chalk.redBright(`Deleted ${file}\n`))
            } else if (action.startsWith('open_')) {
                const file = action.replace('open_', '')

                // detect user OS
                const isWindows = process.platform === 'win32'

                if (isWindows) {
                    exec(`start "" "${file}"`)
                    console.log(chalk.blueBright(`Opening ${file}\n`))
                }

                console.log(chalk.redBright(`Only Windows is supported for now\n`))
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
