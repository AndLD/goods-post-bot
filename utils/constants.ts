import path from 'path'

export const startTimestamp = Date.now()

export const environment = process.env.NODE_ENV || 'development'
export const isProduction = environment === 'production'

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export enum Entity {
    SCHEDULE_ITEMS = 'scheduleItems',
    PROCESSED_ROWS = 'processedRows'
}

export const DEFAULT_SESSION_DATA = { expectingCsv: false, expectingScheduleLabel: false }
export const CSV_FILENAME = 'goods.csv'
export const JSON_FILENAME = 'data.json'

export const staticDir = path.join(__dirname, '..', 'static')
export const csvFilePath = path.join(staticDir, CSV_FILENAME)
export const jsonFilePath = path.join(staticDir, JSON_FILENAME)

export const CSV_COLUMNS = {
    barcode: 0,
    title: 1,
    description: 2,
    price: 3,
    imageUrls: 4,
    combinedOptions: 5
}

export const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
export const SCHEDULE_LABEL_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
