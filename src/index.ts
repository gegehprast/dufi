#!/usr/bin/env node

import { program } from 'commander'
import scan from './scan.js'

program.name('Dufi').description('Find and manage duplicate files').version('0.0.1')

program
    .command('scan <folders...>')
    .option('-e, --extensions <extensions...>', 'filter files by extension', [])
    .option('-b, --bytes <bytes>', 'number of first and last bytes to compare', `${16 * 1024}`)
    .description('scan folders for duplicate files')
    .action((folders, options) => {
        scan(folders, options)
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
