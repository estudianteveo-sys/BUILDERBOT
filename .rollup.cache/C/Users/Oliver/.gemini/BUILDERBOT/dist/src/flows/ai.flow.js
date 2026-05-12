import { addKeyword, EVENTS } from '@builderbot/bot';
import { chatWithIA } from '../services/deepseek.service';
export const aiFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, state }) => {
    const history = (state.getMyState()?.history || []);
    const response = await chatWithIA(history, ctx.body);
    history.push({ role: 'user', content: ctx.body });
    history.push({ role: 'assistant', content: response });
    if (history.length > 40)
        history.splice(0, history.length - 40);
    await state.update({ history });
    await flowDynamic(response);
});
