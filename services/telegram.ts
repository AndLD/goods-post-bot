import axios from 'axios'
import fs from 'fs'
import { Context, Markup, Telegraf } from 'telegraf'
import { Update, Message, InputFile } from 'telegraf/typings/core/types/typegram'
import { TELEGRAM_CHANNEL_ID, DEFAULT_SESSION_DATA, csvFilePath } from '../utils/constants'
import { InputMediaPhoto } from 'telegraf/typings/core/types/typegram'
import { goodsService } from './goods'
import { csvService } from './csv'
import { getLogger } from '../utils/logger'
import { scheduleService } from './schedule'

interface ISessionData {
    expectingCsv: boolean
    expectingScheduleLabel: boolean
}

interface IBotContext extends Context<Update> {
    session?: ISessionData
}

interface IBotContextDocumentMessage extends Context {
    session?: ISessionData
    message:
        | (Update.New & Update.NonChannel & Message.AnimationMessage)
        | (Update.New & Update.NonChannel & Message.DocumentMessage)
}

const logger = getLogger('services/telegram')

export let bot: Telegraf

async function init() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        throw new Error('No TELEGRAM_BOT_TOKEN')
    }

    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

    setupBot()
}

const _downloadAsBuffer = async (url: string) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' })

    return Buffer.from(response.data, 'binary')
}

const _prepareMediaItems = async (imageUrls: string[]) => {
    const buffers = await Promise.all(imageUrls.map(_downloadAsBuffer))
    const media = []
    for (const buffer of buffers) {
        media.push({
            type: 'photo',
            media: {
                source: buffer
            } as InputFile
        } as InputMediaPhoto)
    }

    return media
}

async function postMediaGroup(message: string, imageUrls: string[]) {
    if (!TELEGRAM_CHANNEL_ID) {
        throw new Error('No TELEGRAM_CHANNEL_ID specified')
    }

    try {
        if (!imageUrls.length) {
            await postMessage(message)
            return
        }

        const mediaGroup: InputMediaPhoto[] = await _prepareMediaItems(imageUrls)

        mediaGroup[0].caption = message
        mediaGroup[0].parse_mode = 'Markdown'

        await bot.telegram.sendMediaGroup(TELEGRAM_CHANNEL_ID, mediaGroup)
    } catch (error) {
        logger.error(error)
    }
}

async function postMessage(message: string) {
    if (!TELEGRAM_CHANNEL_ID) {
        throw new Error('No TELEGRAM_CHANNEL_ID specified')
    }

    await bot.telegram.sendMessage(TELEGRAM_CHANNEL_ID, message)
}

const _showMainMenu = (ctx: IBotContext) => {
    const buttons = [
        [Markup.button.callback('Обновить CSV файл', 'update_csv')],
        [Markup.button.callback('График публикаций', 'show_schedule')]
    ]

    if (fs.existsSync(csvFilePath)) {
        buttons.push([Markup.button.callback('Обработать 1 товар', 'process_first_post')])
    }

    ctx.reply('Главное меню', Markup.inlineKeyboard(buttons))
}

const _showSchedule = (ctx: IBotContext) => {
    const schedule = scheduleService.getSchedule()

    const message = schedule.length
        ? `График публикаций:\n\n${schedule.join(
              '\n'
          )}\n\nЧтобы удалить время публикации, нажмите кнопку с соответствующим временем.`
        : 'График публикаций пуст. Добавьте хотя бы одно время публикации, чтобы запустить автоматическую обработку товаров из CSV файла.'

    const buttons = [
        ...schedule.map((label) => [
            Markup.button.callback(label, `remove_from_schedule_${label}`)
        ]),
        [Markup.button.callback('Добавить', 'add_to_schedule')],
        [Markup.button.callback('Главное меню', 'main_menu')]
    ]

    ctx.reply(message, Markup.inlineKeyboard(buttons))
}

async function setupBot() {
    bot.start(_showMainMenu)

    bot.command('menu', _showMainMenu)

    bot.action('update_csv', (ctx: IBotContext) => {
        ctx.answerCbQuery()
        ctx.reply(
            'Пожалуйста, отправьте CSV файл.',
            Markup.inlineKeyboard([[Markup.button.callback('Главное меню', 'main_menu')]])
        )
        ctx.session ??= DEFAULT_SESSION_DATA
        ctx.session.expectingCsv = true
    })

    // Middleware to handle file uploads
    bot.on('document', async (ctx: IBotContextDocumentMessage) => {
        ctx.session ??= DEFAULT_SESSION_DATA
        if (ctx.session.expectingCsv && ctx.message.document) {
            const fileId = ctx.message.document.file_id
            const fileName = ctx.message.document.file_name

            if (fileName?.endsWith('.csv')) {
                const fileLink = await ctx.telegram.getFileLink(fileId)

                csvService.storeCsvFile(
                    fileLink.href,
                    async () => {
                        await ctx.reply('CSV файл обновлен.')
                        ctx.session ??= DEFAULT_SESSION_DATA
                        ctx.session.expectingCsv = false
                        _showMainMenu(ctx)
                    },
                    (err) => {
                        ctx.reply(
                            'Ошибка сохранения CSV файла.',
                            Markup.inlineKeyboard([
                                [Markup.button.callback('Главное меню', 'main_menu')]
                            ])
                        )
                        logger.error(err)
                    }
                )
            } else {
                ctx.reply(
                    'Это не CSV файл. Пожалуйста, отправьте CSV файл.',
                    Markup.inlineKeyboard([[Markup.button.callback('Главное меню', 'main_menu')]])
                )
            }
        }
    })

    bot.action('main_menu', (ctx: IBotContext) => {
        ctx.answerCbQuery()

        if (ctx.session) {
            ctx.session.expectingCsv = false
            ctx.session.expectingScheduleLabel = false
        }

        _showMainMenu(ctx)
    })

    bot.action('show_schedule', (ctx: IBotContext) => {
        ctx.answerCbQuery()

        if (ctx.session) {
            ctx.session.expectingScheduleLabel = false
        }

        _showSchedule(ctx)
    })

    bot.action(/^remove_from_schedule_(([01]\d|2[0-3]):([0-5]\d))$/, (ctx) => {
        ctx.answerCbQuery()
        scheduleService.removeFromSchedule(
            ctx.match[1],
            async () => {
                await ctx.reply('Время публикации удалено!')
                _showSchedule(ctx)
            },
            (message: string) =>
                ctx.reply(
                    message,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('График публикаций', 'show_schedule')],
                        [Markup.button.callback('Главное меню', 'main_menu')]
                    ])
                )
        )
    })

    bot.action('add_to_schedule', (ctx: IBotContext) => {
        ctx.answerCbQuery()
        ctx.reply(
            'Пожалуйста, введите время публикации в формате ЧАСЫ:МИНУТЫ (например, 15:00, 09:05, 00:50 и т.п.)',
            Markup.inlineKeyboard([
                [Markup.button.callback('График публикаций', 'show_schedule')],
                [Markup.button.callback('Главное меню', 'main_menu')]
            ])
        )
        ctx.session ??= DEFAULT_SESSION_DATA
        ctx.session.expectingScheduleLabel = true
    })

    bot.on('message', (ctx: IBotContext) => {
        ctx.session ??= DEFAULT_SESSION_DATA
        if (ctx.session.expectingScheduleLabel && (ctx.message as any)?.text) {
            scheduleService.addToSchedule(
                (ctx.message as any).text,
                async () => {
                    ctx.session ??= DEFAULT_SESSION_DATA
                    ctx.session.expectingScheduleLabel = false
                    await ctx.reply('Время публикации добавлено!')
                    _showSchedule(ctx)
                },
                (message: string) =>
                    ctx.reply(
                        message,
                        Markup.inlineKeyboard([
                            [Markup.button.callback('График публикаций', 'show_schedule')],
                            [Markup.button.callback('Главное меню', 'main_menu')]
                        ])
                    )
            )
        }
    })

    bot.action('process_first_post', (ctx) => {
        ctx.answerCbQuery()
        goodsService.processOneAndRemove(null, (message: string) => ctx.reply(message))
    })

    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))

    await bot
        .launch(() => logger.info('Telegram bot successfully started.'))
        .catch((error) => logger.error('Error starting telegram bot:', error))
}

export const telegramService = {
    init,
    postMediaGroup,
    postMessage,
    setupBot
}
