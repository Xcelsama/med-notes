// Reads the settings Cloudflare gives the function, and says what is missing.
//   env.BUCKET            the R2 bucket, connected by the binding in wrangler.toml (no keys needed)
//   env.NOTEBOOK_PASSWORD the CLASS ACCESS CODE: whoever knows it can create an account (a Pages secret)
//   env.SESSION_SECRET    optional, signs login cookies
export function getConfig(env) {
  const missing = [];
  if (!env || !env.BUCKET) missing.push('BUCKET (R2 binding)');
  if (!env || !env.NOTEBOOK_PASSWORD) missing.push('NOTEBOOK_PASSWORD');
  if (missing.length) return { ready: false, missing, reason: 'Missing settings: ' + missing.join(', ') };
  return { ready: true, missing: [], bucket: env.BUCKET, password: env.NOTEBOOK_PASSWORD, sessionSecret: env.SESSION_SECRET || '' };
}
