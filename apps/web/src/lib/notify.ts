import { toast } from 'sonner';
import { ApiError } from './api';

export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(err: unknown, fallback: string) {
  toast.error(err instanceof ApiError ? err.message : fallback);
}
