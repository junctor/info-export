export function buildManifest({ htConf, schemaVersion }) {
  return {
    code: htConf.code,
    name: htConf.name,
    timezone: htConf.timezone,
    schemaVersion,
    buildTimestamp: new Date().toISOString(),
  };
}
