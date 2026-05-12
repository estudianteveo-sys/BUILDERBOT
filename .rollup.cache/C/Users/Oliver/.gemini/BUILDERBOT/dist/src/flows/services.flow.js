import { addKeyword } from '@builderbot/bot';
import { chatWithIA } from '../services/deepseek.service';
export const servicesFlow = addKeyword(['servicios', 'catálogo', 'catalogo', 'qué hacen', 'producción', 'video', 'ia'])
    .addAction(async (ctx, { flowDynamic, state }) => {
    const history = (state.getMyState()?.history || []);
    const response = await chatWithIA(history, "Por favor, háblame a detalle de los servicios del catálogo que ofrecen en Axis Studio con estimaciones.");
    history.push({ role: 'user', content: ctx.body });
    history.push({ role: 'assistant', content: response });
    if (history.length > 40)
        history.splice(0, history.length - 40);
    await state.update({ history });
    await flowDynamic(response);
});
