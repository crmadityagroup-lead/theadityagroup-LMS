'use client';

import Image from 'next/image';

const DEALER_LOGOS: Array<{ ids: number[]; match: string[]; src: string; alt: string }> = [
  { ids: [1], match: ['aditya motors', 'aditya motor'], src: '/Am-logo.png', alt: 'Aditya Motors logo' },
  { ids: [2], match: ['aditya hyundai', 'aditya honda hyundai'], src: '/Ah-logo.jpeg', alt: 'Aditya Hyundai logo' },
  { ids: [3], match: ['highway honda'], src: '/HH-logo.png', alt: 'Highway Honda logo' },
];

function resolveDealerLogo(dealerName?: string | null, dealerId?: number | null) {
  const normalized = (dealerName || '').toLowerCase().trim();
  return DEALER_LOGOS.find((item) => item.ids.includes(dealerId || 0) || item.match.some((match) => normalized.includes(match))) || null;
}

interface DealerLogoProps {
  dealerName?: string | null;
  dealerId?: number | null;
  size?: number;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover';
  className?: string;
}

export function DealerLogo({ dealerName, dealerId, size = 28, width, height, fit = 'contain', className = '' }: DealerLogoProps) {
  const logo = resolveDealerLogo(dealerName, dealerId);
  if (!logo) return null;
  const imageWidth = width || size;
  const imageHeight = height || size;

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg ${className}`} style={{ width: imageWidth, height: imageHeight }}>
      <Image
        src={logo.src}
        alt={logo.alt}
        width={imageWidth}
        height={imageHeight}
        className={`object-${fit} object-center`}
        style={{ width: '100%', height: '100%' }}
        priority
      />
    </div>
  );
}
