// Cliente HTTP do frontend. Fala apenas com /api (mesma origem); a sessão
// fica em cookies HttpOnly, invisíveis para o JavaScript.

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export async function api(path, { method = 'GET', body, timeout = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch('/api/' + path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'O servidor demorou para responder.' : 'Sem conexão com o servidor.', 0);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Erro ${res.status}`, res.status, data.code);
  return data;
}

/** Envia um arquivo direto ao Supabase Storage usando URL assinada. */
export function uploadTo(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError('Falha no envio do arquivo (' + xhr.status + ')', xhr.status)));
    xhr.onerror = () => reject(new ApiError('Falha de rede no envio do arquivo', 0));
    xhr.send(file);
  });
}

export const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const date = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const bytes = (n) => {
  n = Number(n || 0);
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i];
};
