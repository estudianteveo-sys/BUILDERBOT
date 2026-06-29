import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { PostgreSQLAdapter } from '@builderbot/database-postgres'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import * as dotenv from 'dotenv'
import fs from 'fs'
import https from 'https'
import { 
    chatWithIA, 
    sanitizeResponse, 
    formatPhoneMX, 
    getMexicoTimestamp, 
    getNextAvailableSlots, 
    wait, 
    openaiWhisper,
    processInstagramMessage
} from './services/brain'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

dotenv.config()

const PORT = process.env.PORT ?? 3008

// ============================================================
// FLUJOS DE CONVERSACIÓN
// ============================================================

// --- Flujo de Despedida (detectar fin de conversación para no re-activar el bot) ---
const farewellFlow = addKeyword<Provider, Database>([
    'gracias', 'muchas gracias', 'ok gracias', 'listo gracias', 'hasta luego',
    'adios', 'adiós', 'bye', 'nos vemos', 'hasta pronto', 'ok listo', 'perfecto gracias'
]).addAction(async (ctx, { flowDynamic }) => {
    await flowDynamic([{ body: '¡Con gusto! Fue un placer atenderte. Cuando gustes retomar o tengas alguna duda, aquí estaremos. ¡Hasta pronto! 😊', delay: 1000 }])
})

const welcomeFlow = addKeyword<Provider, Database>([
    'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'iniciar'
]).addAction(async (ctx, { state, flowDynamic }) => {
    const myState = state.getMyState()

    // GUARDIA: Si ya saludamos, procesar mensaje con IA en vez de re-saludar
    if (myState?.hasGreeted) {
        const history = (myState?.history || []) as any[]
        await wait(2500)
        const rawResponse = await chatWithIA(history, ctx.body, true)
        const response = sanitizeResponse(rawResponse, true)
        history.push({ role: 'user', content: ctx.body })
        history.push({ role: 'assistant', content: response })
        if (history.length > 40) history.splice(0, history.length - 40)
        await state.update({ history })
        await flowDynamic([{ body: response, delay: 1000 }])
        return
    }

    // PRIMERA VEZ: Enviar saludo formal y registrar en historial de IA
    const history = (myState?.history || []) as any[]
    history.push({ 
        role: 'assistant', 
        content: 'Hola, te damos la bienvenida a Axis Studio. Soy Axis Bot, asistente de atención inicial a clientes. ¿En qué podemos asesorarte hoy? ¿Deseas conocer los servicios o agendar una llamada?'
    })
    await state.update({ history, hasGreeted: true })

    await flowDynamic([
        { body: 'Hola, te damos la bienvenida a Axis Studio. Soy Axis Bot, asistente de atención inicial a clientes.', delay: 2000 },
        { body: '¿En qué podemos asesorarte hoy? ¿Deseas conocer los servicios o agendar una llamada?', delay: 2000 }
    ])
})



// --- Flujo 2: Pipeline de Cierre -> CRM Webhook ---
const schedulingFlow = addKeyword<Provider, Database>([
    'agendar', 'cita', 'reunion', 'reunión', 'llamada', 'videollamada', 'presencial',
    'cotización', 'cotizacion', 'precio exacto', 'hablar con alguien', 'asesor', 'costo exacto'
]).addAnswer(
    'Me parece excelente. Nos encantará platicar contigo sobre tu proyecto y armarte una propuesta a medida guiada por un creativo experto de nuestro núcleo.',
    { delay: 2000 }
).addAnswer(
    'Para darte un servicio de alta prioridad, por favor indícame tu *Nombre completo* y un *Correo electrónico* válido.',
    { capture: true, delay: 2000 },
    async (ctx, { state }) => { await state.update({ contact_info: ctx.body }) }
).addAnswer(
    'Finalmente, ¿De qué trata tu idea o proyecto corporativo? (Ej. Videoclip, comercial empresarial, reel interno, videopodcast...).',
    { capture: true, delay: 2000 },
    async (ctx, { state }) => { await state.update({ project_type: ctx.body }) }
).addAction(async (ctx, { state, flowDynamic }) => {
    // Iniciar Negociación de Calendario — con slots calculados y calendario revisado
    await flowDynamic([{ body: '¡Perfecto! Ahora busquemos un espacio en la agenda para nuestra llamada.', delay: 1000 }]);
    
    const slots = await getNextAvailableSlots()

    const initPrompt = `Eres el asistente de agendamiento de Axis Studio.
El horario de atención para llamadas es ESTRICTAMENTE de 9:00 AM a 2:00 PM, de lunes a viernes.
Ya revisé la agenda y encontré varios espacios libres. Aquí están todos los horarios disponibles próximos:
${slots.allSlotsText}

OFRECE INICIALMENTE SÓLO LAS DOS PRIMERAS OPCIONES al cliente de forma natural (Ej. "¿Te funciona el martes a las 10:00 AM o a las 10:30 AM?").
No ofrezcas toda la lista de golpe. Sé breve (máximo 2 líneas).`;
    
    try {
        // Usa deepseek a traves de OpenAI, importado de brain
        const { openai } = await import('./services/brain');
        const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: initPrompt }],
            temperature: 0.5,
            max_tokens: 150
        });
        const msg = response.choices[0].message.content || `¿Te funciona el ${slots.option1} o prefieres el ${slots.option2}?`;
        await state.update({ 
            negotiation_history: [{ role: 'assistant', content: msg }],
            slot1_iso: slots.option1Iso,
            slot2_iso: slots.option2Iso,
            slot1_readable: slots.option1,
            slot2_readable: slots.option2
        });
        await flowDynamic([{ body: msg, delay: 1500 }]);
    } catch (e) {
        await flowDynamic(`¿Te funciona el ${slots.option1} o prefieres el ${slots.option2}?`);
    }
}).addAction({ capture: true }, async (ctx, { state, flowDynamic, fallBack }) => {
    // Loop de negociación de fecha
    const myState = state.getMyState();
    const history = myState.negotiation_history || [];
    history.push({ role: 'user', content: ctx.body });

    const slots = await getNextAvailableSlots()
    const currentDate = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy, h:mm a", { locale: es });
    const systemPrompt = `Eres el coordinador de agenda de Axis Studio. Fecha y hora actual: ${currentDate}.
Tu objetivo es acordar una fecha y hora para una videollamada con el cliente.
REGLAS ESTRICTAS:
1. El horario ÚNICO permitido es de 9:00 AM a 2:00 PM, lunes a viernes.
2. Estos son TODOS los horarios que están LIBRES actualmente en la agenda:
${slots.allSlotsText}
3. Si el usuario propone un horario que ESTÁ en la lista de arriba, acéptalo. Si pide "más tarde" o "mañana", revisa la lista de arriba y ofrécele las opciones que coincidan. NO inventes horarios que no estén en la lista.
4. NUNCA asumas que el usuario ha aceptado un horario a menos que te diga explícitamente "sí", "me parece bien", "ok", etc.
5. MUY IMPORTANTE: Una vez que el cliente TE CONFIRME EXPLÍCITAMENTE un día y hora de la lista, DEBES terminar tu mensaje con: [CONFIRMADO: fecha en texto | YYYY-MM-DD HH:mm:00]
   Ejemplo: "Perfecto, agendamos para mañana a las 10 AM. ¡Te espero! [CONFIRMADO: 12 de mayo de 2026, 10:00 AM | 2026-05-12 10:00:00]"
6. Sé amable, breve y natural (máximo 2 líneas).`;

    try {
        const { openai } = await import('./services/brain');
        const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: systemPrompt }, ...history],
            temperature: 0.7,
            max_tokens: 200
        });
        
        const aiResponse = response.choices[0].message.content || '';
        
        // --- DETECCIÓN PRIMARIA: etiqueta [CONFIRMADO] exacta ---
        const confirmMatch = aiResponse.match(/\[CONFIRMADO:\s*(.+?)\s*\|\s*(.+?)\]/);
        
        // --- DETECCIÓN SECUNDARIA: keywords de confirmación (fallback estricto) ---
        const confirmKeywords = ['agendado', 'confirmado', 'confirmada'];
        const looksLikeConfirmation = confirmKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
        
        if (confirmMatch || looksLikeConfirmation) {
            let fechaLimpia = '';
            let fechaIso = '';

            if (confirmMatch) {
                // Camino feliz: la IA incluyó la etiqueta correctamente
                fechaLimpia = confirmMatch[1].trim();
                fechaIso = confirmMatch[2].trim();
            } else {
                // Camino de rescate: extraer la fecha con una segunda llamada de IA
                console.log('⚠️ IA confirmó sin etiqueta. Extrayendo fecha con llamada de rescate...');
                try {
                    const { openai } = await import('./services/brain');
                    const rescueResponse = await openai.chat.completions.create({
                        model: 'deepseek-chat',
                        messages: [{
                            role: 'system',
                            content: `Extrae la fecha y hora de la siguiente confirmación de cita.\nFecha actual de referencia: ${currentDate}.\nResponde ÚNICAMENTE con este formato exacto (sin nada más): TEXTO_LEGIBLE | YYYY-MM-DD HH:mm:00\nEjemplo: "13 de mayo de 2026, 9:00 AM | 2026-05-13 09:00:00"\nMensaje a analizar: "${aiResponse}"`
                        }],
                        temperature: 0,
                        max_tokens: 60
                    });
                    const extracted = rescueResponse.choices[0].message.content?.trim() || '';
                    const parts = extracted.split('|');
                    if (parts.length === 2) {
                        fechaLimpia = parts[0].trim();
                        fechaIso = parts[1].trim();
                    } else {
                        fechaLimpia = myState.slot1_readable || slots.option1;
                        fechaIso = myState.slot1_iso || slots.option1Iso;
                    }
                } catch {
                    fechaLimpia = myState.slot1_readable || slots.option1;
                    fechaIso = myState.slot1_iso || slots.option1Iso;
                }
            }

            // Limpiar la etiqueta del mensaje antes de enviarlo
            const finalMessage = aiResponse.replace(/\[CONFIRMADO:\s*.+?\]/g, '').trim();
            await flowDynamic([{ body: finalMessage, delay: 1000 }]);
            
            // Disparar Webhook con datos limpios
            const payload = {
                telefono: formatPhoneMX(ctx.from),
                contacto: myState.contact_info || 'No proporcionado',
                proyecto: myState.project_type || 'No especificado',
                fecha_acordada: fechaLimpia,
                fecha_iso: fechaIso,
                timestamp: getMexicoTimestamp()
            };
            
            const webhookUrl = process.env.WEBHOOK_CRM || '';
            if(webhookUrl) {
                try {
                    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    console.log('✅ Lead transferido al Webhook de Make.com:', payload);
                } catch(e) { console.error('❌ Error enviando a Webhook', e); }
            } else {
                console.log('⚠️ Webhook no configurado. Datos:', payload);
            }
            
            await flowDynamic([{ body: '¡Todo listo! He agendado la reunión y nuestro equipo se contactará contigo puntualmente. ¡Hasta pronto!', delay: 2000 }]);
            await state.update({ negotiation_history: [] });
            return;
            
        } else {
            // Seguir negociando
            history.push({ role: 'assistant', content: aiResponse });
            await state.update({ negotiation_history: history });
            await flowDynamic([{ body: aiResponse, delay: 1000 }]);
            return fallBack();
        }
    } catch (e) {
        return fallBack('Disculpa, no logré procesar la hora. ¿Me confirmas qué día y a qué hora te marco?');
    }
});

// --- Flujo 3: Inteligencia Generativa (DeepSeek Catch-All) ---
const aiFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
    async (ctx, { flowDynamic, state, gotoFlow }) => {
        
        // INTERCEPTOR (Human Handoff): Si intentan obtener cotizaciones por la fuerza o aceptan agendar, despacharlos a agenda
        const bodyLower = ctx.body.toLowerCase()
        const handoffTriggers = ['llamada', 'cotización', 'cotizacion', 'precio exacto', 'hablar con alguien', 'asesor', 'agendar', 'reunión', 'reunion', 'cita', 'cuanto cuesta', 'cuánto cuesta']
        
        // Detectar si el usuario dice "si" a una propuesta de agendamiento previa
        const myState = state.getMyState()
        const history = (myState?.history || []) as any[]
        const lastAssistantMessage = [...history].reverse().find(m => m.role === 'assistant')?.content.toLowerCase() || ''
        const isAffirmation = ['si', 'sí', 'claro', 'por supuesto', 'va', 'dale', 'me interesa', 'aceptar', 'ok', 'agendemos'].some(aff => bodyLower === aff || bodyLower.startsWith(aff + ' '))
        const botWasAskingToSchedule = ['agendar', 'llamada', 'cita', 'reunión', 'reunion'].some(kw => lastAssistantMessage.includes(kw))

        if (handoffTriggers.some(trigger => bodyLower.includes(trigger)) || (isAffirmation && botWasAskingToSchedule)) {
            return gotoFlow(schedulingFlow)
        }

        // LÓGICA DE MEMORIA AI 
        const hasGreeted = myState?.hasGreeted || false
        
        // Anti-ban mock
        await wait(2500)
        
        // Petición al LLM (CAPA 2: con flag hasGreeted para inyección de meta-contexto)
        const rawResponse = await chatWithIA(history, ctx.body, hasGreeted)

        // CAPA 3: Sanitizar respuesta para eliminar saludos repetidos
        const response = sanitizeResponse(rawResponse, hasGreeted)

        // Alimentar Loop de Memoria Restricta
        history.push({ role: 'user', content: ctx.body })
        history.push({ role: 'assistant', content: response })
        if (history.length > 40) history.splice(0, history.length - 40)

        await state.update({ history, hasGreeted: true })
        await flowDynamic([{ body: response, delay: 1000 }]) // Capa final antispam 
    }
)

// --- Flujo 4: Recepción Visual Delegada ---
const mediaFlow = addKeyword<Provider, Database>([EVENTS.MEDIA, EVENTS.DOCUMENT]).addAction(
    async (ctx, { flowDynamic }) => {
        await flowDynamic('¡Hemos recibido tu archivo con éxito! Como Asistente de IA todavía no puedo analizar imágenes o videos en detalle. Sin embargo, todo queda resguardado para que un humano de nuestro equipo lo revise antes de tu consultoría.\n\n¿Te gustaría comentarme un poco más de tu proyecto por texto o agendar una llamada?');
    }
)

// --- Flujo 5: Extracción de Whisper (Voice Notes) ---
const voiceFlow = addKeyword<Provider, Database>(EVENTS.VOICE_NOTE).addAction(
    async (ctx, { provider, state, flowDynamic, gotoFlow }) => {
        try {
            await flowDynamic([{ body: 'Escuchando tu nota de voz...', delay: 500 }]);
            
            // Descargar el audio temporalmente
            const localPath = await provider.saveFile(ctx, { path: process.cwd() });
            
            // Procesar con OpenAI Whisper (Cliente real OpenAI)
            const transcription = await openaiWhisper.audio.transcriptions.create({
                file: fs.createReadStream(localPath),
                model: 'whisper-1',
            });
            
            // Limpiar el audio temporal del servidor
            fs.unlinkSync(localPath);
            
            const incomingText = transcription.text;
            
            // Handoff humano (idéntico al aiFlow)
            const bodyLower = incomingText.toLowerCase()
            const handoffTriggers = ['llamada', 'cotización', 'cotizacion', 'precio exacto', 'hablar con alguien', 'asesor', 'agendar', 'reunión', 'reunion', 'cita', 'cuanto cuesta', 'cuánto cuesta']
            if (handoffTriggers.some(trigger => bodyLower.includes(trigger))) {
                return gotoFlow(schedulingFlow)
            }
            
            // Historial global IA con flag de saludo
            const myState = state.getMyState()
            const history = (myState?.history || []) as any[]
            const hasGreeted = myState?.hasGreeted || false
            await wait(1000)
            
            // CAPA 2: Pasar hasGreeted para meta-contexto
            const rawResponse = await chatWithIA(history, incomingText, hasGreeted)

            // CAPA 3: Sanitizar respuesta
            const response = sanitizeResponse(rawResponse, hasGreeted)

            history.push({ role: 'user', content: incomingText })
            history.push({ role: 'assistant', content: response })
            if (history.length > 40) history.splice(0, history.length - 40)

            await state.update({ history, hasGreeted: true })
            await flowDynamic([{ body: response, delay: 1000 }])
        } catch (error) {
            console.error('Whisper Error:', error);
            await flowDynamic('Disculpa, tuve un problema técnico procesando tu nota de voz. ¿Podrías explicármelo por texto?');
        }
    }
)

// ============================================================
// ARRANQUE ROOT
// ============================================================
const main = async () => {
    // Pipeline jerárquico estricto
    const adapterFlow = createFlow([farewellFlow, welcomeFlow, schedulingFlow, mediaFlow, voiceFlow, aiFlow])

    const adapterProvider = createProvider(Provider, {
        experimentalStore: true,
        // Limpiador automático programado (Builderbot Default Protocol)
        timeRelease: 10800000, 
        version: [2, 3000, 1035824857],
    })

    let adapterDB: any;
    if (process.env.POSTGRES_DB_URI) {
        const dbUrl = new URL(process.env.POSTGRES_DB_URI);
        adapterDB = new PostgreSQLAdapter({
            host: dbUrl.hostname,
            user: decodeURIComponent(dbUrl.username),
            database: decodeURIComponent(dbUrl.pathname.slice(1)) || 'postgres',
            password: decodeURIComponent(dbUrl.password),
            port: parseInt(dbUrl.port || '5432'),
        });
        console.log('✅ Conectado a Base de Datos PostgreSQL (Supabase)');
    } else {
        adapterDB = new Database();
        console.log('⚠️ Usando MemoryDB (Base de datos volátil). Configura POSTGRES_DB_URI en .env para persistencia.');
    }

    const { httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // --- INSTAGRAM WEBHOOK ENDPOINT ---
    // Make.com enviará las peticiones POST a este endpoint
    const server: any = adapterProvider.server;
    server.post(
        '/v1/instagram',
        async (req: any, res: any) => {
            try {
                const { userId, text, channel, triggerType, userName } = req.body || {};
                
                if (!userId || !text) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Faltan campos obligatorios: userId, text' }));
                    return;
                }

                console.log(`[Instagram] Mensaje de ${userName || userId}: ${text}`);
                
                // Llamar al cerebro unificado
                const responseText = await processInstagramMessage(userId, text, userName);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    response: responseText,
                    action: 'send_dm',
                    userId: userId
                }));
            } catch (error) {
                console.error('[Instagram Webhook] Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error procesando el mensaje' }));
            }
        }
    );

    // --- KEEP-ALIVE PARA EVITAR PAUSADO DE SUPABASE ---
    if (process.env.POSTGRES_DB_URI) {
        const KEEP_ALIVE_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas en milisegundos

        const pingDatabase = async () => {
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    if (adapterDB && adapterDB.db) {
                        await adapterDB.db.query('SELECT 1;');
                        console.log(`🔄 [Keep-Alive] Ping exitoso a Supabase (${new Date().toISOString()})`);
                        return; // Éxito, salir del loop
                    } else {
                        console.warn('⚠️ [Keep-Alive] adapterDB.db no disponible, saltando ping.');
                        return;
                    }
                } catch (error) {
                    console.error(`❌ [Keep-Alive] Intento ${attempt}/${maxRetries} falló:`, error);
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 5000)); // Esperar 5s antes de reintentar
                    }
                }
            }
            console.error('❌ [Keep-Alive] Todos los intentos de ping fallaron.');
            
            // Enviar alerta directa a Telegram a través de HTTPS
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const userId = process.env.TELEGRAM_USER_ID;

            if (!botToken || !userId) {
                console.warn('⚠️ [Keep-Alive] TELEGRAM_BOT_TOKEN o TELEGRAM_USER_ID no configurados. No se pudo enviar la alerta.');
                return;
            }

            try {
                const message = `🚨 *ALERTA CRÍTICA — BUILDERBOT (Railway)*\n\n` +
                                `⚠️ *Incidente:* Todos los intentos de ping a Supabase fallaron en la nube.\n` +
                                `⏰ *Fecha/Hora:* ${new Date().toISOString()}\n\n` +
                                `Nota: Revisa si el proyecto de Supabase necesita ser despausado manualmente o si las credenciales de conexión son correctas.`;

                const payload = JSON.stringify({
                    chat_id: userId,
                    text: message,
                    parse_mode: 'Markdown'
                });

                const options = {
                    hostname: 'api.telegram.org',
                    port: 443,
                    path: `/bot${botToken}/sendMessage`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': ByteLength(payload)
                    }
                };

                // Función auxiliar para calcular tamaño en bytes
                function ByteLength(str: string) {
                    return Buffer.byteLength(str, 'utf8');
                }

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            console.log('🚨 [Keep-Alive] Alerta de fallo enviada con éxito a Telegram.');
                        } else {
                            console.error(`❌ [Keep-Alive] Error al enviar alerta a Telegram: Status ${res.statusCode} - ${data}`);
                        }
                    });
                });

                req.on('error', (err) => {
                    console.error('❌ [Keep-Alive] Error de red al enviar alerta a Telegram:', err);
                });

                req.write(payload);
                req.end();

            } catch (err) {
                console.error('❌ [Keep-Alive] Excepción al intentar enviar alerta a Telegram:', err);
            }
        };

        // Ping inmediato al arrancar (no esperar 6 horas)
        console.log('🔄 [Keep-Alive] Iniciando keep-alive de Supabase (ping cada 6 horas).');
        pingDatabase();

        // Ping periódico cada 6 horas
        setInterval(pingDatabase, KEEP_ALIVE_INTERVAL);
    }

    httpServer(+PORT)
}

main()

