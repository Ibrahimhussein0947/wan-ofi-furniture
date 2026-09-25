import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { errorMessage } from '../api/client';

/**
 * useMutation with success/error toasts and cache invalidation.
 * `invalidate` is a list of query-key prefixes to refresh on success.
 */
export default function useMutationToast(mutationFn, { success, invalidate = [], onSuccess, onError } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      const message = typeof success === 'function' ? success(data, variables) : success;
      if (message) toast.success(message);
      invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }));
      onSuccess?.(data, variables);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      onError?.(error);
    },
  });
}
