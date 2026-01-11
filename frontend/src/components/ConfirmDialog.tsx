import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog = ({
  isOpen,
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  onConfirm,
  onCancel,
  variant = 'warning'
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    info: 'bg-primary-500 hover:bg-primary-600'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-slideUp">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X size={20} className="text-slate-400" />
        </button>

        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${
            variant === 'danger' ? 'bg-red-100' : 
            variant === 'warning' ? 'bg-yellow-100' : 
            'bg-blue-100'
          }`}>
            <AlertTriangle 
              size={24} 
              className={
                variant === 'danger' ? 'text-red-600' : 
                variant === 'warning' ? 'text-yellow-600' : 
                'text-blue-600'
              } 
            />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        </div>

        {/* Message */}
        <p className="text-slate-600 mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook for easier usage
export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = React.useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    message: ''
  });

  const confirm = (
    message: string,
    options?: {
      title?: string;
      variant?: 'danger' | 'warning' | 'info';
    }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        message,
        title: options?.title,
        variant: options?.variant,
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        }
      });
      
      // Store cancel resolver
      (setDialogState as any).cancelResolve = () => resolve(false);
    });
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      message={dialogState.message}
      title={dialogState.title}
      variant={dialogState.variant}
      onConfirm={() => dialogState.onConfirm?.()}
      onCancel={() => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
        ((setDialogState as any).cancelResolve as (() => void))?.();
      }}
    />
  );

  return { confirm, ConfirmDialogComponent };
};

import React from 'react';
