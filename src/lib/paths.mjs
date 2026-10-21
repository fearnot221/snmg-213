const base = (import.meta.env?.BASE_URL || '/snmg-213/').replace(/\/$/, '');
export function withBase(path = '/') {
  if (!path.startsWith('/') || path.startsWith('//') || path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`)) return path;
  return `${base}${path}`;
}
export const repositoryUrl = 'https://github.com/fearnot221/snmg-213';
export const cmsUrl = 'https://snmg-213-admin.kenin221.workers.dev/';
