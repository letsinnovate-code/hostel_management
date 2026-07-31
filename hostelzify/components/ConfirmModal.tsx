'use client';

import { useState, useEffect } from 'react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

interface InternalConfirmOptions extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

class ConfirmModalManager {
  private listeners: Set<(options: InternalConfirmOptions | null) => void> = new Set();
  private currentOptions: InternalConfirmOptions | null = null;

  subscribe(listener: (options: InternalConfirmOptions | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentOptions));
  }

  show(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.currentOptions = {
        ...options,
        onConfirm: () => {
          this.hide();
          resolve(true);
        },
        onCancel: () => {
          this.hide();
          resolve(false);
        },
      };
      this.notify();
    });
  }

  hide() {
    this.currentOptions = null;
    this.notify();
  }
}

export const confirmModalManager = new ConfirmModalManager();

export function useConfirmModal() {
  const [options, setOptions] = useState<InternalConfirmOptions | null>(null);

  useEffect(() => {
    const unsubscribe = confirmModalManager.subscribe(setOptions);
    return () => {
      unsubscribe();
    };
  }, []);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return confirmModalManager.show(options);
  };

  return { options, confirm };
}

export default function ConfirmModal() {
  const { options } = useConfirmModal();

  if (!options) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          {options.title && (
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{options.title}</h3>
          )}
          <p className="text-gray-700 mb-6">{options.message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={options.onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              {options.cancelText || 'Cancel'}
            </button>
            <button
              onClick={options.onConfirm}
              className={`px-4 py-2 rounded-md text-white ${
                options.confirmButtonClass || 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {options.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

