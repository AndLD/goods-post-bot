import fs from 'fs'
import { parse } from 'csv-parse'
import { stringify } from 'csv-stringify'
import { csvFilePath } from '../utils/constants'
import { getLogger } from '../utils/logger'
import axios from 'axios'

const logger = getLogger('services/csv')

async function getRows(): Promise<string[][]> {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(csvFilePath)) {
            const rows: string[][] = []

            fs.createReadStream(csvFilePath)
                .pipe(parse({ delimiter: ',' }))
                .on('data', (row) => rows.push(row))
                .on('end', () => resolve(rows))
                .on('error', (err) => logger.error(err))
        } else {
            logger.error('CSV file not found')
            reject('CSV file not found')
        }
    })
}

async function overrideRows(rows: string[][]) {
    stringify(rows, { delimiter: ',' }, (err: Error | undefined, output: any) => {
        if (err) {
            logger.error('Error stringifying CSV:', err)
            return
        }
        fs.writeFile(csvFilePath, output, (err) => {
            if (err) {
                logger.error('Error writing to CSV file:', err)
            } else {
                logger.info('Processed row is removed from CSV file.')
            }
        })
    })
}

async function storeCsvFile(
    fileUrl: string,
    successCallback: () => void,
    errorCallback: (err: Error) => void
) {
    const response = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'stream'
    })

    const writer = fs.createWriteStream(csvFilePath)
    response.data.pipe(writer)
    writer.on('finish', successCallback)
    writer.on('error', errorCallback)
}

export const csvService = {
    getRows,
    overrideRows,
    storeCsvFile
}
