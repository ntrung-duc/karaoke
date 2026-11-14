import {readConfig} from './server/config.mjs';
import {createApplication} from './server/application.mjs';

const config = readConfig();
const application = createApplication(config);
application.server.listen(config.port, config.host, () => {
  console.log('Rạp Âm http://localhost:' + application.server.address().port);
});
application.server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Cổng ${config.port} đang được sử dụng. Dừng phiên cũ hoặc đặt PORT khác.`
    : error);
  process.exitCode = 1;
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await application.close();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
