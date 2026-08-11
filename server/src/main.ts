import { bootstrap } from './bootstrap';

async function start() {
  const app = await bootstrap();
  await app.listen(process.env.PORT ?? 3000);
}
void start();
