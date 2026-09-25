import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../api/endpoints';
import { setCurrency } from '../utils/format';

/** Loads the business currency once so every amount is formatted consistently. */
export function SettingsLoader() {
  const { data } = useQuery({ queryKey: ['public-settings'], queryFn: publicApi.settings, staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (data?.currency) setCurrency(data.currency);
  }, [data]);
  return null;
}

export const usePublicSettings = () => useQuery({ queryKey: ['public-settings'], queryFn: publicApi.settings, staleTime: 5 * 60 * 1000 });
