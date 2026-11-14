import {readConfig} from '../server/config.mjs';
import {createApplication} from '../server/application.mjs';

// Vercel's Node runtime accepts an exported HTTP server, including upgrade
// handlers. Never listen on a port here, and never use per-instance RAM in cloud.
const application=createApplication({...readConfig(),requireRedis:true,rotateAfterMs:240000});
export default application.server;
