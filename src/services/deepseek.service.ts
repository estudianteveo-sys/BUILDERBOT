import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../config/system-prompt';
import { KNOWLEDGE_BASE } from '../config/knowledge-base';
import * as dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
});

/**
 * Función central de procesamiento de IA
 * @param history El historial de conversación entre bot y cliente 
 * @returns La respuesta de texto generada por DeepSeek Chat
 */
export const chatWithIA = async (
    history: { role: 'system' | 'user' | 'assistant', content: string }[],
    incomingMessage: string
): Promise<string> => {
    try {
        const messages: any[] = [
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
            max_tokens: 500 // Respuestas concisas para WhatsApp
        });

        return response.choices[0].message.content || 'Hubo un error de procesamiento. Por favor, contáctanos directamente.';
    } catch (error) {
        console.error('Error en DeepSeek API:', error);
        return 'Lo siento, en este momento mis sistemas están actualizándose. Por favor, intenta de nuevo en unos minutos o ponte en contacto directamente a nuestro WhatsApp oficial.';
    }
};
