import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onDismiss: (id: string) => void;
  duration?: number; // in milliseconds, default to 3000
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onDismiss, duration = 5000 }) => { // MODIFIED: Changed default duration to 5000
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleTransitionEnd = () => {
    if (!isVisible) {
      onDismiss(id);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'error':
        return <XCircle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'info':
        return 'bg-blue-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-700 text-white';
    }
  };

  return (
    <div
      className={`flex items-center p-4 rounded-lg shadow-lg transition-all duration-300 transform ${getColors()}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      onTransitionEnd={handleTransitionEnd}
      role="alert"
    >
      <div className="flex-shrink-0 mr-2">
        {getIcon()}
      </div>
      <div className="text-sm font-medium flex-grow">
        {message}
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="ml-auto -mx-1.5 -my-1.5 bg-transparent text-white rounded-lg p-1.5 hover:bg-opacity-20 inline-flex items-center justify-center h-8 w-8"
        aria-label="Dismiss"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;