#!/usr/bin/env node

import { program } from 'commander'
import scan from './scan.js'
import purge from './purge.js'
import chalk from 'chalk'
import pkg from '../package.json' assert { type: 'json' }

program
    .name('dufi')
    .description('Find and manage duplicate files')
    .version(pkg.version)
    .usage('<command> [options]')

program
    .command('scan <folders...>')
    .option('-w, --web', 'start the web UI to manage the duplicates (alias for scan-web)', false)
    .option('-e, --extensions [extensions...]', 'filter files by extension', [])
    .option('-b, --bytes [bytes]', 'number of first and last bytes to compare', `${16 * 1024}`)
    .description('scan folders for duplicate files')
    .addHelpText('after', '\nExample:\n  dufi scan .\n  dufi scan FolderA FolderB\n')
    .action((folders, options) => {
        scan(folders, options)
    })

program
    .command('scan-web <folders...>')
    .option('-e, --extensions [extensions...]', 'filter files by extension', [])
    .option('-b, --bytes [bytes]', 'number of first and last bytes to compare', `${16 * 1024}`)
    .description('scan and start the web UI to manage the duplicates (alias for scan -w)')
    .action((folders, options) => {
        scan(folders, { ...options, web: true })
    })

program
    .command('purge')
    .description('purge the cache file')
    .action(() => {
        purge()
    })

program.parse()

process.on('uncaughtException', (error) => {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.log('Cancelled by user. Press enter to exit...')
    } else {
        if (process.env.NODE_ENV === 'development') {
            throw error
        } else {
            console.error(chalk.redBright(`\n${error.message}`))
            process.exit(1)
        }
    }
})

process.on('SIGINT', () => {
    process.exit(0)
})

process.on('SIGQUIT', () => {
    process.exit(0)
})

process.on('SIGTERM', () => {
    process.exit(0)
})

process.on('exit', () => {
    console.log(chalk.green('\nGoodbye!'))
    process.exit(0)
})
