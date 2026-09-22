import { useEffect, useState } from 'react';

/** Minimal promise → state hook for the static loaders. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): { data?: T; error?: Error } {
  const [state, setState] = useState<{ data?: T; error?: Error }>({});
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ data }),
      (error: Error) => live && setState({ error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
