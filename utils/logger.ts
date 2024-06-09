import log4js from 'log4js'
import moment from 'moment'

log4js.configure({
    appenders: {
        file: {
            type: 'file',
            filename: `logs/${moment(Date.now()).format('DD.MM.YYYY_HH-mm-ss')}.log`
        },
        con: { type: 'console' }
    },

    categories: {
        default: { appenders: ['file', 'con'], level: 'info' }
    }
})

export function getLogger(module: string) {
    const logger = log4js.getLogger(module)
    logger.level = 'info'
    return logger
}
