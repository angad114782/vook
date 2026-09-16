import type { CSSProperties } from 'react';
import type { AuthUser } from '../../store/authStore';

const avatarColors = [
  { bg: '#dff5ef', color: '#0d5c57' },
  { bg: '#e7efff', color: '#3157a5' },
  { bg: '#fff0d9', color: '#9a5b12' },
  { bg: '#f5e9ff', color: '#7a3a9b' },
];

const getInitials = (name: string) => name
  .split(' ')
  .map((part) => part[0])
  .filter(Boolean)
  .slice(0, 2)
  .join('')
  .toUpperCase();

interface UserAvatarProps {
  user?: Pick<AuthUser, 'name' | 'avatar'> | null;
  name?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export default function UserAvatar({ user, name, size = 40, className, style }: UserAvatarProps) {
  const label = name ?? user?.name ?? 'User';
  const palette = avatarColors[(label.charCodeAt(0) || 0) % avatarColors.length]!;
  const dimensions = { width: size, height: size, ...style };

  if (user?.avatar) {
    return <img className={className} src={user.avatar} alt={`${label} profile`} style={{ ...dimensions, objectFit: 'cover' }} />;
  }

  return <div className={className} role="img" aria-label={`${label} profile`} style={{ ...dimensions, display: 'grid', placeItems: 'center', backgroundColor: palette.bg, color: palette.color, fontSize: Math.max(11, Math.round(size * 0.3)), fontWeight: 800 }}>
    {getInitials(label)}
  </div>;
}
