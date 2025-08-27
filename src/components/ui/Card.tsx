import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false
}) => {
  // MODIFIED: Changed dark:bg-gray-800 to dark:bg-gray-400 for a slightly lighter dark theme
  const baseStyles = 'bg-white dark:bg-gray-400 rounded-lg shadow-md dark:shadow-lg overflow-hidden';
  // MODIFIED: Added dark:hover:shadow-xl
  const hoverStyles = hoverable ? 'transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-xl cursor-pointer' : '';
  const clickHandler = hoverable && onClick ? onClick : undefined;
  
  return (
    <div 
      className={`${baseStyles} ${hoverStyles} ${className}`}
      onClick={clickHandler}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = ''
}) => {
  // MODIFIED: Added dark:border-gray-700 and dark:text-white
  return (
    <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 dark:text-white ${className}`}>
      {children}
    </div>
  );
};

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  className = ''
}) => {
  // MODIFIED: Added dark:text-gray-200 for default text color within CardBody
  return (
    <div className={`px-6 py-4 dark:text-gray-400 ${className}`}>
      {children}
    </div>
  );
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = ''
}) => {
  // MODIFIED: Added dark:border-gray-700
  return (
    <div className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
};

export default Card;