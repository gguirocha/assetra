import schedule from 'node-schedule';
import { checkAndSendExpirationAlerts } from './services/expiration.service';
import { checkAndGeneratePreventiveOrders } from './services/preventive.service';
import { checkAndSendSlaAlerts } from './services/sla.service';

export function setupScheduler() {
    console.log('Inicializando agendador de tarefas...');

    // Executar todo dia à 1 da manhã
    schedule.scheduleJob('0 1 * * *', async () => {
        console.log('Executando schedule diário (Vencimento de documentos, CNH, seguros...)...');
        await checkAndSendExpirationAlerts();

        console.log('Executando verificação de Planos Preventivos...');
        await checkAndGeneratePreventiveOrders();
    });

    // Executar a cada 15 minutos (para OS atrasada ou SLAs curtos)
    schedule.scheduleJob('*/15 * * * *', async () => {
        console.log('Executando schedule 15m (Check SLAs)...');
        await checkAndSendSlaAlerts();
    });
}
