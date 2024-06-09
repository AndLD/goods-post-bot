import OpenAI from 'openai'
import { getLogger } from '../utils/logger'

const logger = getLogger('services/openai')

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

async function prompt(prompt: string) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }]
        })

        const text = response.choices[0].message.content

        return text ? text.replace('```json', '').replace('```', '').trim() : null
    } catch (error) {
        logger.error(error)
    }
}

export const openaiService = {
    prompt
}
