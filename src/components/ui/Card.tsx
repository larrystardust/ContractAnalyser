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
  // MODIFIED: Changed dark:bg-gray-400 to dark:bg-gray-800 for a darker dark theme
  const baseStyles =
    'bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-lg overflow-hidden';
  // MODIFIED: Added dark:hover:shadow-xl
  const hoverStyles = hoverable
    ? 'transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-xl cursor-pointer'
    : '';
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
  // MODIFIED: Added dark:border-gray-700 and dark:text-gray-100
  return (
    <div
      className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 dark:text-gray-100 ${className}`}
    >
      {children}
    </div>
  );
};

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements; // NEW: allows switching wrapper element
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  className = '',
  as = 'div' // default stays <div>
}) => {
  const Component = as as keyof JSX.IntrinsicElements;

  // MODIFIED: Changed dark:text-gray-400 to dark:text-gray-200 for better visibility
  return (
    <Component className={`px-6 py-4 dark:text-gray-200 ${className}`}>
      {children}
    </Component>
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
    <div
      className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;