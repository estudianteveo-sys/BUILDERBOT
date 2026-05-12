import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../config/system-prompt';
import { KNOWLEDGE_BASE } from '../config/knowledge-base';
import * as dotenv from 'dotenv';
dotenv.config();
const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
});
export const chatWithIA = async (history, incomingMessage) => {
    try {
        const messages = [
            {
                role: 'system',
                content: `${SYSTEM_PROMPT}\n\n[CONTEXTO RAG / DOCUMENTACIÓN CORPORATIVA]:\n${KNOWLEDGE_BASE}`
            },
            ...history,
            { role: 'user', content: incomingMessage }
        ];
        const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        });
        return response.choices[0].message.content || 'Hubo un error de procesamiento. Por favor, contáctanos directamente.';
    }
    catch (error) {
        console.error('Error en DeepSeek API:', error);
        return 'Lo siento, en este momento mis sistemas están actualizándose. Por favor, intenta de nuevo en unos minutos o ponte en contacto directamente a nuestro WhatsApp oficial.';
    }
};
