import { addKeyword } from '@builderbot/bot';
export const welcomeFlow = addKeyword(['hola', 'hello', 'hi', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'])
    .addAnswer('¡Hola! Bienvenido a *Axis Studio* 🎬')
    .addAnswer('Soy tu Consultor Creativo, diseñado para ayudarte a escalar tu producción visual asistida por Inteligencia Artificial y liberarla de fricciones logísticas.')
    .addAnswer('¿Te gustaría conocer nuestros *Servicios*, resolver alguna duda técnica o prefieres *Agendar* una cita directamente?');
