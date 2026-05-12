import { addKeyword } from '@builderbot/bot';
export const schedulingFlow = addKeyword(['agendar', 'cita', 'reunion', 'reunión', 'llamada', 'videollamada', 'presencial'])
    .addAnswer('¡Excelente decisión! 📅 Nos encantará platicar contigo sobre tu proyecto y armarte una propuesta a medida sin costo logístico tradicional.')
    .addAnswer('Por favor, dime tu *Nombre* y un *Email* de contacto para tener tus datos.', { capture: true }, async (ctx, { state }) => {
    await state.update({ contact_info: ctx.body });
})
    .addAnswer('¿De qué trata tu proyecto? Cuéntame brevemente (Ej. Videoclip, comercial de producto, videopodcast, etc.)', { capture: true }, async (ctx, { state }) => {
    await state.update({ project_type: ctx.body });
})
    .addAnswer('Perfecto. He tomado nota de tu solicitud. Un humano de nuestro equipo directivo se pondrá en contacto contigo a este número muy pronto para confirmar la hora de la videollamada. ¡Gracias por confiar la creatividad de tu proyecto a Axis Studio!');
