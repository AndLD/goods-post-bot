import { CronJob } from 'cron'
import { scheduleService } from './schedule'
import { getLogger } from '../utils/logger'
import { goodsService } from './goods'

const logger = getLogger('services/cron')

let jobs: CronJob[] = []

function init() {
    const schedule = scheduleService.getSchedule()
    _applyCronSchedule(schedule)
    logger.info('Cron initialized:', schedule)
}

function resetCron(schedule: string[]) {
    _stopCronJobs()
    _applyCronSchedule(schedule)
    logger.info('Cron reset:', schedule)
}

function _applyCronSchedule(schedule: string[]) {
    schedule.forEach((label) => {
        const [hour, minute] = label.split(':')
        const cronTime = `${minute} ${hour} * * *`
        const job = new CronJob(
            cronTime,
            goodsService.processOneAndRemove,
            null,
            true,
            'Europe/Kiev'
        )
        jobs.push(job)
        job.start()
    })
}

function _stopCronJobs() {
    jobs.forEach((job) => job.stop())
    jobs = []
}

export const cronService = {
    init,
    resetCron
}
