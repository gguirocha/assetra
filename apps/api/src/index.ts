import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: join(__dirname, '../../../.env') });

import fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health';
import { bootstrapAdmin } from './bootstrap';
import { setupScheduler } from './scheduler';

const app = fastify({ logger: true });

app.register(cors, {
    origin: true,
});

// Registrar rotas
app.register(healthRoutes, { prefix: '/api' });

// Início do servidor
const start = async () => {
    try {
        // 1. Roda bootstrap (cria admin se não existir)
        await bootstrapAdmin();

        // 2. Setup dos agendamentos (Node Schedule)
        setupScheduler();

        const port = Number(process.env.PORT) || 3333;
        const host = process.env.HOST || '0.0.0.0';

        await app.listen({ port, host });
        console.log(`🚀 API rodando em http://${host}:${port}`);

    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
