import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { format, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { google } from 'googleapis';

dotenv.config();

// ============================================================
// 1. CONFIGURACIÓN CENTRAL (KNOWLEDGE BASE & PROMPTS)
// ============================================================

export const KNOWLEDGE_BASE = `
# Catálogo de Servicios Profesionales: Axis Studio

1. Tutoría Personalizada:
- ¿En qué consiste?: Capacitación y formación 101 completamente práctica y adaptada al nivel del cliente para dominar el ecosistema de IA actual.
- ¿Qué podemos hacer?: Entrenamiento en creación y edición de video con IA (Kling, Veo, Higgsfield). Clases personalizadas de diseño sonoro y composición musical con IA (Suno, ElevenLabs). Tutorías de desarrollo ágil (Vibe Coding) con Replit para programar y prototipar sin experiencia.

2. Implementación de IA:
- ¿En qué consiste?: Despliegue e integración de sistemas de inteligencia artificial directamente en la estructura operativa o de producción de agencias y negocios.
- ¿Qué podemos hacer?: Configuración de flujos inteligentes con ChatGPT, Claude y Gemini. Instalación de flujos de generación masiva de contenido de texto, imagen y video con consistencia de marca. Implementación de marcos con agentes autónomos para delegar tareas repetitivas.

3. Consultoría Creativa:
- ¿En qué consiste?: Asesoramiento estratégico de alto nivel, dirección de arte digital e ingeniería de prompts avanzada para llevar ideas conceptuales a producciones comerciales.
- ¿Qué podemos hacer?: Dirección de arte multimedia para campañas digitales y contenido orgánico. Ingeniería de prompts avanzada en modelos de imagen de precisión (Nano Banana, Easy Dream) para estilos consistentes. Conceptualización y guionismo estratégico.

4. Desarrollo de Apps:
- ¿En qué consiste?: Construcción y maquetación a medida de aplicaciones web y plataformas digitales interactivas con superpoderes de inteligencia artificial integrados.
- ¿Qué podemos hacer?: Integración directa de APIs de IA (Gemini API, DeepSeek API, Brave Search API). Estructuración de bases de datos seguras con Supabase (Row-Level Security). Infraestructura y despliegue rápido en Railway y Vercel.

5. Landing Pages:
- ¿En qué consiste?: Diseño y estructuración de páginas de aterrizaje de alto rendimiento, optimizadas técnicamente para maximizar la conversión comercial y capturar leads.
- ¿Qué podemos hacer?: Interfaces UI limpias, responsivas y enfocadas en UX. Integración de asistentes virtuales y bots para atender clientes en tiempo real. Optimización de velocidad para campañas en redes.

6. Automatizaciones:
- ¿En qué consiste?: Diseño de conectores inteligentes y ecosistemas digitales interconectados que trabajan por la empresa en segundo plano para eliminar tareas manuales.
- ¿Qué podemos hacer?: Creación de escenarios avanzados en Make para automatizar seguimiento de prospectos y alimentar bases en tiempo real. Integración de WhatsApp Business para respuestas inmediatas. Automatización de pipelines de publicación y distribución.

# RANGOS PARÁMETRICOS INTERNOS DE VIDEOS (Referencia de contexto, nunca cotización final)
- "Chico ave" (Storytelling Cinematográfico): $8,000-$15,000 MXN.
- "Sonido Popular" (Cultura Sonidera): $15,000-$25,000 MXN.
- "SPINNRADIO PROMO" (Promo holográfico): $3,000-$8,000 MXN.
- "PROMO ONU" (Vocería Institucional): $3,000-$8,000 MXN.
- "CON EL CORAZÓN" (Estilismo digital de alimentos): $3,000-$8,000 MXN.
`;

export const SYSTEM_PROMPT = `
###############################################
# REGLA ABSOLUTA #0 — PRIORIDAD MÁXIMA       #
# (ESTA REGLA ANULA CUALQUIER OTRA CONDUCTA)  #
###############################################

Si en el historial de esta conversación ya existe AL MENOS UN mensaje tuyo (role: assistant), entonces:
- TIENES TERMINANTEMENTE PROHIBIDO volver a saludar, presentarte o dar la bienvenida.
- NO digas "Hola", "Bienvenido/a", "Te damos la bienvenida", "Soy Axis Bot" ni ninguna variación.
- RESPONDE DIRECTAMENTE a lo que el usuario pregunta, sin preámbulos ni introducciones.
- Si la pregunta del usuario es sobre un tema específico (servicios, herramientas, costos), contesta ESO y solo ESO.
- VIOLACIÓN DE ESTA REGLA = FALLO CRÍTICO DEL SISTEMA.

###############################################

INSTRUCCIÓN MAESTRA:
Eres "Axis Bot", el asistente automatizado de Axis Studio, encargado de agilizar la atención inicial, calificar leads y promover los servicios de producción audiovisual y soluciones de IA. Tu objetivo final es canalizar al cliente a una llamada con un creativo y nunca dar precios en firme.

1. Identidad y Personalidad
- Tu nombre es "Axis Bot". Eres parte del equipo de Axis Studio.
- Si un cliente pregunta si eres humano o bot, responde: "Soy el asistente automatizado de Axis Studio encargado de agilizar tu atención inicial. Si lo prefieres, puedo canalizarte con un creativo humano para una atención personalizada. ¿Te gustaría agendar una llamada?"
- Trato profesional, ejecutivo, sin emojis infantiles.
- Saludo Único: Solo saludas en tu PRIMERÍSIMA interacción (historial vacío). Después, RESPONDE DIRECTO.

2. Base de Conocimiento y Servicios
- Tienes pleno conocimiento de nuestros 6 servicios profesionales: 1) Tutoría Personalizada, 2) Implementación de IA, 3) Consultoría Creativa, 4) Desarrollo de Apps, 5) Landing Pages, 6) Automatizaciones.
- Cuando te pregunten qué podemos hacer en alguna de estas categorías, explica de forma amable, muy breve y sencilla, sin tecnicismos innecesarios, destacando las plataformas con las que trabajamos (como Supabase, Make, Replit, ElevenLabs, Suno, etc.).
- Tras responder brevemente a cualquier duda sobre un servicio, realiza siempre un llamado a la acción suave invitando a agendar una sesión consultiva gratuita (videollamada) para ver los detalles del proyecto del cliente.

3. Fase de Validación: El Portafolio
- Solo pregunta por el portafolio (https://axis-portafolio.vercel.app/) si el usuario pide detalles específicos de videos y no lo ha revisado previamente.

4. Valor Técnico y Costos
- Resalta el valor de la IA para liberar fricciones logísticas y reducir costos de un 70% a 90% respecto a producción tradicional.
- NUNCA des presupuestos exactos en el chat. Ofrece agendar la llamada para cotizar a medida.

5. PROACTIVIDAD EN AGENDAMIENTO
- Si el usuario muestra cualquier intención de agendar, cotizar o hablar con un asesor, ofrece de inmediato agendar la llamada solicitando Nombre y Correo electrónico.

Formato: Párrafos breves (máximo 2-3 líneas). Sin títulos markdown de gran tamaño. Diseñado para WhatsApp móvil.
`;

// ============================================================
// 2. CLIENTES EXTERNOS (LLM y Calendario)
// ============================================================

export const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
});

// Cliente separado para Whisper de OpenAI genuino
export const openaiWhisper = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


// ============================================================
// 3. FUNCIONES DE SANITIZACIÓN Y UTILIDADES
// ============================================================

const GREETING_PATTERNS = [
    /hola,?\s*(te\s+)?damos\s+la\s+bienvenida/gi,
    /te\s+damos\s+la\s+bienvenida\s+a\s+axis\s+studio/gi,
    /soy\s+(el\s+asistente\s+de\s+)?axis\s+(bot|studio)/gi,
    /bienvenid[oa]\s+a\s+axis\s+studio/gi,
    /una\s+ia\s+diseñada\s+para\s+la\s+atención\s+inicial/gi,
    /asistente\s+de\s+atención\s+inicial\s+a\s+clientes/gi,
    /¿en\s+qué\s+(te\s+puedo|podemos)\s+asesorar(te)?\s+(hoy|el\s+día\s+de\s+hoy)\?/gi,
];

export const sanitizeResponse = (response: string, hasGreeted: boolean): string => {
    if (!hasGreeted) return response; // Primera interacción, dejar pasar

    let cleaned = response;
    for (const pattern of GREETING_PATTERNS) {
        cleaned = cleaned.replace(pattern, '').trim();
    }

    // Limpiar puntuación huérfana y saltos de línea excesivos
    cleaned = cleaned.replace(/^[.,;:!?\s]+/, '').replace(/\n{3,}/g, '\n\n').trim();

    // Si después de limpiar queda vacío o muy corto, generar respuesta alternativa
    if (cleaned.length < 15) {
        return '¿En qué más puedo ayudarte con tu proyecto?';
    }

    return cleaned;
};

export const formatPhoneMX = (phone: string): string => {
    if (phone.startsWith('521') && phone.length === 13) {
        const cleaned = phone.slice(3); // Quitar '521'
        return `52 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
};

export const getMexicoTimestamp = (): string => {
    return new Date().toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
    });
};

// ============================================================
// 4. LÓGICA DE CALENDARIO (GOOGLE CALENDAR)
// ============================================================

export const getBusyEvents = async (): Promise<{start: Date, end: Date}[]> => {
    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!calendarId || !serviceAccountKey) return [];

        const credentials = JSON.parse(serviceAccountKey);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        });

        const calendar = google.calendar({ version: 'v3', auth });
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 7); // Consultar los próximos 7 días

        const res = await calendar.events.list({
            calendarId,
            timeMin: now.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        return (res.data.items || []).map(event => {
            return {
                start: new Date(event.start?.dateTime || event.start?.date || ''),
                end: new Date(event.end?.dateTime || event.end?.date || '')
            };
        });
    } catch (e) {
        console.error('⚠️ No se pudo consultar el calendario:', e);
        return [];
    }
};

export const getNextAvailableSlots = async (): Promise<{ allSlotsText: string, option1: string, option2: string, option1Iso: string, option2Iso: string }> => {
    const busyEvents = await getBusyEvents();
    
    const now = new Date();
    const mexicoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    const minutes = mexicoNow.getMinutes();

    // Redondear al siguiente cuarto de hora
    const minuteRemainder = minutes % 15;
    const minutesToAdd = minuteRemainder === 0 ? 0 : (15 - minuteRemainder);
    const roundedBase = addMinutes(mexicoNow, minutesToAdd);
    roundedBase.setSeconds(0, 0);

    const isValidSlot = (candidate: Date): boolean => {
        const candHour = candidate.getHours();
        const candDay = candidate.getDay();
        // Fuera de horario laboral
        if (candHour < 9 || candHour >= 14 || candDay === 0 || candDay === 6) return false;
        
        // Verificar si choca con algún evento ocupado (asumimos duración de 30 min)
        const candidateEnd = addMinutes(candidate, 30);
        for (const event of busyEvents) {
            const actualEventEnd = event.start.getTime() === event.end.getTime() ? addMinutes(event.end, 30) : event.end;
            if (candidate < actualEventEnd && candidateEnd > event.start) return false;
        }
        return true;
    };

    const slots: Date[] = [];
    let currentCandidate = addMinutes(roundedBase, 30); // Empezar a buscar desde +30 mins
    
    let iterations = 0;
    while (slots.length < 20 && iterations < 300) {
        if (isValidSlot(currentCandidate)) {
            slots.push(new Date(currentCandidate));
        }
        currentCandidate = addMinutes(currentCandidate, 30);
        
        if (currentCandidate.getHours() >= 14) {
            currentCandidate.setDate(currentCandidate.getDate() + 1);
            currentCandidate.setHours(9, 0, 0, 0);
        }
        iterations++;
    }

    const fmtReadable = (d: Date) => format(d, "EEEE d 'de' MMMM, h:mm a", { locale: es });
    const fmtIso = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:00');

    const availableSlotsList = slots.map(d => `- ${fmtReadable(d)}`).join('\n');

    return {
        allSlotsText: availableSlotsList,
        option1: slots[0] ? fmtReadable(slots[0]) : '',
        option2: slots[1] ? fmtReadable(slots[1]) : '',
        option1Iso: slots[0] ? fmtIso(slots[0]) : '',
        option2Iso: slots[1] ? fmtIso(slots[1]) : ''
    };
};

// ============================================================
// 5. CEREBRO DE IA CENTRAL
// ============================================================

export const chatWithIA = async (
    history: { role: 'system' | 'user' | 'assistant'; content: string }[],
    incomingMessage: string,
    hasGreeted: boolean = false
): Promise<string> => {
    try {
        const messages: any[] = [
            {
                role: 'system',
                content: `${SYSTEM_PROMPT}\n\n[RAG DE REFERENCIA INTERNA]:\n${KNOWLEDGE_BASE}`,
            },
            ...history,
        ];

        // Si ya saludó, inyectar recordatorio explícito justo antes del mensaje del usuario
        if (hasGreeted && history.length > 0) {
            messages.push({
                role: 'system',
                content: '[RECORDATORIO DEL SISTEMA]: Ya te presentaste anteriormente en esta conversación. NO vuelvas a saludar ni a presentarte. Responde DIRECTAMENTE a la siguiente pregunta del usuario sin preámbulos de bienvenida.'
            });
        }

        messages.push({ role: 'user', content: incomingMessage });

        const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500,
        });
        return response.choices[0].message.content || 'Hubo un error de procesamiento.';
    } catch (error) {
        console.error('DeepSeek Error:', error);
        return 'Esa información no la tengo disponible de momento, pero si dejas tus datos, un asesor te contactará a la brevedad para darte el detalle exacto.';
    }
};

// ============================================================
// 6. CONTROLADOR DE INSTAGRAM (ESTADO EN MEMORIA)
// ============================================================

interface SessionState {
    history: { role: 'user' | 'assistant', content: string }[];
    hasGreeted: boolean;
    flowState: 'general' | 'scheduling_collect_data' | 'scheduling_negotiation';
    contact_info?: string;
    project_type?: string;
    negotiation_history?: { role: 'user' | 'assistant', content: string }[];
    slot1_iso?: string;
    slot2_iso?: string;
    slot1_readable?: string;
    slot2_readable?: string;
}

// Almacén en memoria para Instagram (se pierde al reiniciar)
const instagramSessions = new Map<string, SessionState>();

export const processInstagramMessage = async (userId: string, text: string, userName: string = 'Usuario'): Promise<string> => {
    // 1. Cargar o crear sesión
    if (!instagramSessions.has(userId)) {
        instagramSessions.set(userId, {
            history: [],
            hasGreeted: false,
            flowState: 'general'
        });
    }
    const session = instagramSessions.get(userId)!;
    const bodyLower = text.toLowerCase();

    // 2. Manejo según el estado del flujo
    
    // --- ESTADO: NEGOCIACIÓN DE CALENDARIO ---
    if (session.flowState === 'scheduling_negotiation') {
        const history = session.negotiation_history || [];
        history.push({ role: 'user', content: text });
        
        const slots = await getNextAvailableSlots();
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
            const response = await openai.chat.completions.create({
                model: 'deepseek-chat',
                messages: [{ role: 'system', content: systemPrompt }, ...history],
                temperature: 0.7,
                max_tokens: 200
            });
            
            const aiResponse = response.choices[0].message.content || '';
            const confirmMatch = aiResponse.match(/\[CONFIRMADO:\s*(.+?)\s*\|\s*(.+?)\]/);
            const confirmKeywords = ['agendado', 'confirmado', 'confirmada'];
            const looksLikeConfirmation = confirmKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
            
            if (confirmMatch || looksLikeConfirmation) {
                let fechaLimpia = confirmMatch ? confirmMatch[1].trim() : (session.slot1_readable || slots.option1);
                let fechaIso = confirmMatch ? confirmMatch[2].trim() : (session.slot1_iso || slots.option1Iso);
                
                // Enviar webhook a Make.com CRM
                const payload = {
                    telefono: `IG_${userId}`,
                    contacto: session.contact_info || userName,
                    proyecto: session.project_type || 'Instagram Lead',
                    fecha_acordada: fechaLimpia,
                    fecha_iso: fechaIso,
                    timestamp: getMexicoTimestamp()
                };
                const webhookUrl = process.env.WEBHOOK_CRM || '';
                if (webhookUrl) {
                    try {
                        await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    } catch (e) { console.error('Error Webhook CRM', e); }
                }
                
                session.flowState = 'general';
                session.negotiation_history = [];
                return aiResponse.replace(/\[CONFIRMADO:\s*.+?\]/g, '').trim() + '\n\n¡Todo listo! He agendado la reunión y nuestro equipo se contactará contigo puntualmente. ¡Hasta pronto!';
            } else {
                history.push({ role: 'assistant', content: aiResponse });
                session.negotiation_history = history;
                return aiResponse;
            }
        } catch (e) {
            return 'Disculpa, no logré procesar la hora. ¿Me confirmas qué día y a qué hora te marco?';
        }
    }
    
    // --- ESTADO: RECOLECCIÓN DE DATOS PARA AGENDAR ---
    if (session.flowState === 'scheduling_collect_data') {
        if (!session.contact_info) {
            session.contact_info = text;
            return 'Finalmente, ¿De qué trata tu idea o proyecto corporativo? (Ej. Videoclip, comercial empresarial, reel interno, videopodcast...).';
        }
        if (!session.project_type) {
            session.project_type = text;
            session.flowState = 'scheduling_negotiation';
            
            const slots = await getNextAvailableSlots();
            const initPrompt = `Eres el asistente de agendamiento de Axis Studio.
El horario de atención para llamadas es ESTRICTAMENTE de 9:00 AM a 2:00 PM, de lunes a viernes.
Ya revisé la agenda y encontré varios espacios libres. Aquí están todos los horarios disponibles próximos:
${slots.allSlotsText}

OFRECE INICIALMENTE SÓLO LAS DOS PRIMERAS OPCIONES al cliente de forma natural (Ej. "¿Te funciona el martes a las 10:00 AM o a las 10:30 AM?").
No ofrezcas toda la lista de golpe. Sé breve (máximo 2 líneas).`;

            try {
                const response = await openai.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [{ role: 'system', content: initPrompt }],
                    temperature: 0.5,
                    max_tokens: 150
                });
                const msg = response.choices[0].message.content || `¿Te funciona el ${slots.option1} o prefieres el ${slots.option2}?`;
                
                session.negotiation_history = [{ role: 'assistant', content: msg }];
                session.slot1_iso = slots.option1Iso;
                session.slot2_iso = slots.option2Iso;
                session.slot1_readable = slots.option1;
                session.slot2_readable = slots.option2;
                
                return `¡Perfecto! Ahora busquemos un espacio en la agenda para nuestra llamada.\n\n${msg}`;
            } catch (e) {
                return `¡Perfecto! ¿Te funciona el ${slots.option1} o prefieres el ${slots.option2}?`;
            }
        }
    }

    // --- ESTADO: GENERAL (INTERCEPTOR Y LLM) ---
    
    // Interceptor Handoff a Agendamiento
    const handoffTriggers = ['llamada', 'cotización', 'cotizacion', 'precio exacto', 'hablar con alguien', 'asesor', 'agendar', 'reunión', 'reunion', 'cita', 'cuanto cuesta', 'cuánto cuesta'];
    const lastAssistantMessage = [...session.history].reverse().find(m => m.role === 'assistant')?.content.toLowerCase() || '';
    const isAffirmation = ['si', 'sí', 'claro', 'por supuesto', 'va', 'dale', 'me interesa', 'aceptar', 'ok', 'agendemos'].some(aff => bodyLower === aff || bodyLower.startsWith(aff + ' '));
    const botWasAskingToSchedule = ['agendar', 'llamada', 'cita', 'reunión', 'reunion'].some(kw => lastAssistantMessage.includes(kw));

    if (handoffTriggers.some(trigger => bodyLower.includes(trigger)) || (isAffirmation && botWasAskingToSchedule)) {
        session.flowState = 'scheduling_collect_data';
        session.contact_info = undefined;
        session.project_type = undefined;
        return 'Me parece excelente. Nos encantará platicar contigo sobre tu proyecto y armarte una propuesta a medida guiada por un creativo experto de nuestro núcleo.\n\nPara darte un servicio de alta prioridad, por favor indícame tu *Nombre completo* y un *Correo electrónico* válido.';
    }

    // Petición al LLM General
    const rawResponse = await chatWithIA(session.history as any, text, session.hasGreeted);
    const response = sanitizeResponse(rawResponse, session.hasGreeted);

    session.history.push({ role: 'user', content: text });
    session.history.push({ role: 'assistant', content: response });
    if (session.history.length > 40) session.history.splice(0, session.history.length - 40);
    session.hasGreeted = true;

    return response;
};
