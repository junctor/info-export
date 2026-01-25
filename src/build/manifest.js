export function buildManifest({ htConf }) {
  return {
    code: htConf.code,
    name: htConf.name,
    timezone: htConf.timezone,
    buildTimestamp: new Date().toISOString(),
  };
}
