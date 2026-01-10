
import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * OFFICIAL FENDEX LOGISTICS ICON
 * STATUS: LOCKED (v1.0.1)
 * SOURCE: /public/icons/icon-512.png
 * NOTE: Color classes (e.g. text-blue-600) are ignored to preserve official brand colors.
 */
export const FendexIcon: React.FC<IconProps> = ({ className = "", size = 24 }) => {
  return (
    <img
      src="/icons/icon-512.png"
      alt="Fendex Logistics"
      className={className}
      style={{ 
        width: size, 
        height: size, 
        objectFit: 'contain',
        display: 'block'
      }}
      role="img"
    />
  );
};
