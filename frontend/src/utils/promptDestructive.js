import { apiErrorMessage } from './apiErrorMessage';

/**
 * Warning toast with Cancel + confirm (replaces window.confirm).
 * @param {(message: string, type?: string, extra?: object | null) => void} show from `useToast()`
 */
export function promptDestructive(show, {
  message,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
}) {
  show(message, 'warning', {
    position: 'top-center',
    actions: [
      { label: cancelLabel, variant: 'secondary', onClick: () => {} },
      {
        label: confirmLabel,
        variant: confirmVariant,
        onClick: async () => {
          try {
            await Promise.resolve(onConfirm());
          } catch (err) {
            show(apiErrorMessage(err, 'Action failed'), 'error');
          }
        },
      },
    ],
  });
}
