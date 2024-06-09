import fs from 'fs'
import { jsonFilePath, SCHEDULE_LABEL_PATTERN } from '../utils/constants'
import { getLogger } from '../utils/logger'
import { cronService } from './cron'

const logger = getLogger('services/schedule')

function _getData() {
    return JSON.parse(fs.readFileSync(jsonFilePath).toString())
}

function _saveData(data: any) {
    fs.writeFileSync(jsonFilePath, JSON.stringify(data))
}

function init() {
    if (!fs.existsSync(jsonFilePath)) {
        _saveData({ schedule: [] })
    }
}

function isLabelValid(label: string, fallback: (message: string) => void) {
    const timePattern = SCHEDULE_LABEL_PATTERN
    const isValid = timePattern.test(label)

    if (!isValid) {
        logger.error('Invalid schedule label')
        fallback('Введено неправильное время. Попробуйте еще раз.')
    }

    return isValid
}

function getSchedule() {
    const data = _getData()
    return data.schedule as string[]
}

function _saveSchedule(schedule: string[]) {
    const data = _getData()
    data.schedule = schedule
    _saveData(data)
    cronService.resetCron(schedule)
}

function addToSchedule(
    label: string,
    successCallback: () => void,
    fallback: (message: string) => void
) {
    if (!isLabelValid(label, fallback)) {
        return
    }

    let schedule = getSchedule()

    if (schedule.includes(label)) {
        fallback(`Время ${label} уже есть в графике публикаций.`)
        return
    }

    schedule.push(label)

    schedule.sort((a, b) => {
        const [aHours, aMinutes] = a.split(':').map(Number)
        const [bHours, bMinutes] = b.split(':').map(Number)

        return aHours - bHours || aMinutes - bMinutes
    })

    _saveSchedule(schedule)

    successCallback()
}

function removeFromSchedule(
    label: string,
    successCallback: () => void,
    fallback: (message: string) => void
) {
    if (!isLabelValid(label, fallback)) {
        logger.error('Invalid schedule label')
        return
    }

    const schedule = getSchedule()

    const updatedSchedule = schedule.filter((_label) => _label !== label)

    if (updatedSchedule.length === schedule.length) {
        fallback('Такого времени нет в графике публикаций.')
        return
    }

    _saveSchedule(updatedSchedule)

    successCallback()
}

export const scheduleService = {
    init,
    getSchedule,
    addToSchedule,
    removeFromSchedule
}
