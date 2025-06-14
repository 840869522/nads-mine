import React, { ReactNode } from 'react';
import { InformationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon as SolidXCircleIcon } from '@heroicons/react/24/solid'; // Renamed to avoid conflict
import { XCircleIcon } from '@heroicons/react/24/outline'; // For dismiss button

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  type?: AlertType;
  title?: string;
  message: ReactNode;
  className?: string;
  onClose?: () => void;
}

const alertStyles = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900',
    iconColor: 'text-blue-400 dark:text-blue-300',
    titleColor: 'text-blue-800 dark:text-blue-200',
    textColor: 'text-blue-700 dark:text-blue-300',
    Icon: InformationCircleIcon,
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900',
    iconColor: 'text-green-400 dark:text-green-300',
    titleColor: 'text-green-800 dark:text-green-200',
    textColor: 'text-green-700 dark:text-green-300',
    Icon: CheckCircleIcon,
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900',
    iconColor: 'text-yellow-400 dark:text-yellow-300',
    titleColor: 'text-yellow-800 dark:text-yellow-200',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    Icon: ExclamationTriangleIcon,
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900',
    iconColor: 'text-red-400 dark:text-red-300',
    titleColor: 'text-red-800 dark:text-red-200',
    textColor: 'text-red-700 dark:text-red-300',
    Icon: SolidXCircleIcon, // Using the solid version for error indication
  },
};

const Alert: React.FC<AlertProps> = ({ type = 'info', title, message, className = '', onClose }) => {
  const styles = alertStyles[type];
  const Icon = styles.Icon;

  return (
    <div className={`rounded-md p-4 shadow ${styles.bg} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${styles.iconColor}`} aria-hidden="true" />
        </div>
        <div className="ml-3">
          {title && <h3 className={`text-sm font-medium ${styles.titleColor}`}>{title}</h3>}
          <div className={`text-sm ${styles.textColor} ${title ? 'mt-2' : ''}`}>
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex rounded-md p-1.5 ${styles.textColor} hover:bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.bg === 'bg-red-50 dark:bg-red-900' || styles.bg === 'bg-red-50' ? 'focus:ring-offset-red-50 dark:focus:ring-offset-red-900 focus:ring-red-600' : 'focus:ring-offset-neutral-50 dark:focus:ring-offset-neutral-900 focus:ring-neutral-600' }`}
              >
                <span className="sr-only">关闭</span>
                <XCircleIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;