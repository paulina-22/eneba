import { useEffect, useState } from 'react';
import { apiGet } from './api';

export type ApiResource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useApiResource<T>(path: string): ApiResource<T> {
  const [resource, setResource] = useState<ApiResource<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setResource((current) => ({ ...current, loading: true, error: null }));

    apiGet<T>(path)
      .then((data) => {
        if (active) setResource({ data, loading: false, error: null });
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResource({
            data: null,
            loading: false,
            error:
              requestError instanceof Error
                ? requestError.message
                : 'Unable to load this section.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [path]);

  return resource;
}
