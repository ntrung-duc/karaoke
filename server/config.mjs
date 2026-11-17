export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 0 đến 65535.');
  }
  return {
    port,
    host: env.HOST || env.IP || '0.0.0.0',
    livekitUrl: env.LIVEKIT_URL || undefined,
    livekitApiKey: env.LIVEKIT_API_KEY || undefined,
    livekitApiSecret: env.LIVEKIT_API_SECRET || undefined,
    stateMode: env.ROOM_STATE_MODE || (env.VERCEL ? 'shared' : 'local'),
    redisUrl: env.REDIS_URL || undefined,
    youtubeApiKey: env.YOUTUBE_API_KEY || undefined,
    redisPrefix: env.REDIS_PREFIX || (env.VERCEL ? `karaoke:v1:${env.VERCEL_ENV||'development'}${env.VERCEL_ENV==='preview'?':'+(env.VERCEL_GIT_COMMIT_REF||'preview'):''}` : 'karaoke:v1'),
    rotateAfterMs: env.VERCEL ? 240000 : 0,
    ice: env.TURN_URL ? [{urls: env.TURN_URL, username: env.TURN_USER, credential: env.TURN_PASSWORD}] : [],
  };
}
