export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type ApiOptions = {
  baseUrl: string;
  getToken: () => string | null | undefined;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
};

export type ApiInit = { method?: string; body?: unknown };

export function createApi(o: ApiOptions) {
  return async function api<T = any>(path: string, init: ApiInit = {}): Promise<T> {
    const token = o.getToken();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const hasBody = init.body !== undefined;
    if (hasBody) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await (o.fetchImpl ?? fetch)(o.baseUrl + path, {
        method: init.method ?? 'GET',
        headers,
        body: hasBody ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor');
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* corpo não-JSON */
    }
    if (!res.ok) {
      if (res.status === 401 && token) o.onUnauthorized?.();
      throw new ApiError(res.status, data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? 'Erro inesperado');
    }
    return data as T;
  };
}
