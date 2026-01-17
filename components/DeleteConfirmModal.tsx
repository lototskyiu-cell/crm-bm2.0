
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  isDeleting?: boolean;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Видалити?",
  message = "Ви впевнені? Цю дію не можна скасувати.",
  isDeleting = false,
  confirmText = "Видалити",
  cancelText = "Скасувати",
  confirmButtonClass = "bg-red-600 hover:bg-red-700 shadow-red-200"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20}/>
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isDeleting}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 text-white font-bold rounded-lg transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center ${confirmButtonClass}`}
              disabled={isDeleting}
            >
              {isDeleting ? 'Обробка...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
