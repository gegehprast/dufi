import DuplicateFinder from './DuplicateFinder.js'
import chalk from 'chalk'

export default async function purge() {
    DuplicateFinder.purgeCache()

    console.log(chalk.greenBright('Cache purged!'))
}
