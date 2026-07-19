import { BadgeCheck } from 'lucide-react';

interface Props { size?: number; className?: string; }

const VerifiedBadge = ({ size = 16, className = '' }: Props) => (
  <BadgeCheck
    className={`inline-block text-[hsl(205,90%,55%)] fill-[hsl(205,90%,55%)] stroke-white ${className}`}
    style={{ width: size, height: size }}
    strokeWidth={2.5}
    aria-label="Verified"
  />
);

export default VerifiedBadge;