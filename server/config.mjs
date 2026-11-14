export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 0 đến 65535.');
  }
  return {
    port,
    host: env.HOST || '0.0.0.0',
    ice: env.TURN_URL ? [{urls: env.TURN_URL, username: env.TURN_USER, credential: env.TURN_PASSWORD}] : [],
  };
}
