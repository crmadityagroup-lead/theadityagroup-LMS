'use client';

interface GeneratedAvatarProps {
  seed: string;
  name: string;
  size?: number;
}

const PALETTE = ['#3B82F6', '#8B5CF6', '#F97316', '#22C55E', '#06B6D4', '#EF4444', '#EAB308'];

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomValue(seed: number, offset: number) {
  const value = Math.sin(seed * 0.0001 + offset * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function GeneratedAvatar({ seed, name, size = 32 }: GeneratedAvatarProps) {
  const hash = hashSeed(seed || name || 'user');
  const background = PALETTE[hash % PALETTE.length];
  const secondary = PALETTE[(hash >>> 3) % PALETTE.length];
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
  const circleX = 10 + randomValue(hash, 1) * 12;
  const circleY = 10 + randomValue(hash, 2) * 12;
  const circleRadius = 7 + randomValue(hash, 3) * 7;
  const rotate = Math.round(randomValue(hash, 4) * 24 - 12);

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`${name} avatar`} className="shrink-0 rounded-full">
      <rect width="40" height="40" rx="20" fill={background} />
      <circle cx={circleX} cy={circleY} r={circleRadius} fill={secondary} opacity="0.8" />
      <path d="M-4 35 Q 9 20 21 31 T44 25 V44 H-4Z" fill="#111827" opacity="0.24" />
      <text x="20" y="24" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="Arial, sans-serif" transform={`rotate(${rotate} 20 20)`}>{initials}</text>
    </svg>
  );
}
