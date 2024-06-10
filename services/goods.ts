import { Markup } from 'telegraf'
import { IGood } from '../utils/interfaces/goods'
import { CALL_TO_ACTION_BUTTON_URL, CSV_COLUMNS } from '../utils/constants'
import { getLogger } from '../utils/logger'
import { csvService } from './csv'
import { openaiService } from './openai'
import { telegramService } from './telegram'

const logger = getLogger('services/goods')

function _mapCsvRowToGood(row: string[]) {
    if (row.length < 6) {
        throw new Error('Unable to map csv row to good, looks like columns count is less than 6')
    }

    const good: IGood = {
        barcode: row[CSV_COLUMNS.barcode],
        title: row[CSV_COLUMNS.title],
        description: row[CSV_COLUMNS.description],
        price: parseFloat(row[CSV_COLUMNS.price]),
        combinedOptions: row[CSV_COLUMNS.combinedOptions],
        imageUrls: row[CSV_COLUMNS.imageUrls].split(',').map((url) => url.trim())
    }

    return good
}

function _getInstruction(description: string) {
    return `There is description of a good. Replace HTML with plain text. Make shorter it's structure and text, final result should 200 symbols max. When you write "Розмір" of a good, use "x" instead of "*" between numbers. Send result in JSON "result" field.
\`\`\`${description}\`\`\``
}

async function processOneAndRemove(rows: string[][] | null, fallback?: (message: string) => void) {
    if (!rows) {
        rows = await csvService.getRows()
    }

    if (rows.length <= 1) {
        logger.info('No rows left in CSV file.')
        fallback && fallback('Не залошилось рядків у CSV файлі або CSV файл ще не завантажено.')
        return
    }

    let [rowToProcess] = rows.splice(1, 1)
    const good = _mapCsvRowToGood(rowToProcess)

    if (!good.title) {
        await processOneAndRemove(rows, fallback)

        return
    }

    if (good.description) {
        const response = await openaiService.prompt(_getInstruction(good.description))

        if (response) {
            logger.info(`ChatGPT response: "${response}"`)

            const json = JSON.parse(response)

            if (json?.result) {
                good.description = json.result
            }
        }
    }

    const message = `*${good.title}*${
        good.description ? '\n\n' + good.description : ''
    }\n\n*Ціна: ${good.price} грн*${
        good.combinedOptions ? '\n\n' + good.combinedOptions : ''
    }\n\nШтрихкод: ${good.barcode}`

    if (CALL_TO_ACTION_BUTTON_URL) {
        const buttons = [Markup.button.url('Замовити зараз', CALL_TO_ACTION_BUTTON_URL)]

        await telegramService.postMediaGroup(good.imageUrls)
        await telegramService.postMessage(message, buttons)
    } else {
        await telegramService.postMediaGroup(good.imageUrls, message)
    }

    csvService.overrideRows(rows)
}

export const goodsService = {
    processOneAndRemove
}
