import { useEffect, useState } from 'react';

/**
 * Atrasa valores de pesquisa (ex.: 300ms) para evitar re-filtragens pesadas a cada tecla,
 * mas limpa imediatamente quando o texto fica vazio.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    if (typeof value === 'string' && value.trim() === '') {
      setDebouncedValue(value);
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
