
import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  footer?: ReactNode;
  icon?: React.ReactNode; // Added icon prop
}

const Card: React.FC<CardProps> = ({ children, title, icon, className = '', footer }) => {
  return (
    <div className={`bg-white dark:bg-neutral-800 shadow-lg rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center"> {/* Flex container for icon and title */}
            {icon && <span className="mr-3 flex-shrink-0">{icon}</span>} {/* Render icon if provided */}
            <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
          </div>
        </div>
      )}
      <div className="px-4 py-5 sm:p-6">
        {children}
      </div>
      {footer && (
         <div className="px-4 py-4 sm:px-6 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
           {footer}
         </div>
      )}
    </div>
  );
};

export default Card;
