type ApiEnvelope<T> = {
  data: T;
  error?: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${apiBaseUrl}${normalizedPath}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    const errorMessage =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `API request failed with status ${response.status}.`;

    throw new Error(errorMessage);
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload)
  ) {
    throw new Error('The API returned an invalid response.');
  }

  return (payload as ApiEnvelope<T>).data;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiMutate<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  csrfToken: string,
): Promise<T> {
  return apiRequest<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: { 'X-CSRF-Token': csrfToken },
  });
}
