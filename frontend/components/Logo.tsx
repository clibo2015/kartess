import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  sm: { width: 32, height: 32 },
  md: { width: 48, height: 48 },
  lg: { width: 64, height: 64 },
  xl: { width: 120, height: 120 },
};

export default function Logo({ 
  size = 'md', 
  showText = false, 
  className = '',
  onClick 
}: LogoProps) {
  const router = useRouter();
  const dimensions = sizeMap[size];
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push('/');
    }
  };

  return (
    <motion.div
      onClick={handleClick}
      className={`flex items-center gap-2 ${!onClick ? 'cursor-pointer' : ''} ${className}`}
      whileHover={!onClick ? { scale: 1.05 } : {}}
      whileTap={!onClick ? { scale: 0.95 } : {}}
    >
      <div className="relative" style={{ width: dimensions.width, height: dimensions.height }}>
        {!imageError ? (
          <Image
            src="/kartess-logo.png"
            alt="Kartess Logo"
            width={dimensions.width}
            height={dimensions.height}
            className="object-contain"
            priority={size === 'xl' || size === 'lg'}
            onError={() => setImageError(true)}
          />
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br from-blue-600 via-pink-600 to-green-600 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ fontSize: `${dimensions.width * 0.4}px` }}
          >
            K
          </div>
        )}
      </div>
      {showText && (
        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-pink-600 to-green-600 bg-clip-text text-transparent">
          Kartess
        </span>
      )}
    </motion.div>
  );
}

