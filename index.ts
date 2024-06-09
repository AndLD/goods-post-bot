import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` })
import { getLogger } from './utils/logger'
import { staticDir } from './utils/constants'
import { telegramService } from './services/telegram'
import { scheduleService } from './services/schedule'
import { cronService } from './services/cron'

const logger = getLogger('index')

function setupApp() {
    if (!fs.existsSync(staticDir)) {
        fs.mkdirSync(staticDir)
    }

    telegramService.init()
    scheduleService.init()
    cronService.init()
}

setupApp()

process.on('uncaughtException', function (err) {
    logger.error(`UNCAUGHT EXCEPTION: ${err}`)
})
