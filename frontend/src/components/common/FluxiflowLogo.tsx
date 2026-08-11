import React from 'react';
import { useAppTheme } from '../../context/ThemeContext';

interface FluxiflowLogoProps {
  /** Height in pixels. Defaults to 60. */
  height?: number;
}

/**
 * Theme-aware Fluxiflow logo.
 *
 * - Light theme  → /Fluxiflow logo white.png
 * - Dark theme   → /Fluxiflow logo black.png
 * - System theme → resolved automatically via ThemeContext
 *
 * Uses files from frontend/public/ via Vite's public asset path.
 * Do NOT use CSS filter/invert — the two source images are used directly.
 */
export const FluxiflowLogo: React.FC<FluxiflowLogoProps> = ({ height = 60 }) => {
  const { isDark } = useAppTheme();
  const src = isDark
    ? '/Fluxiflow logo black.png'
    : '/Fluxiflow logo white.png';
  return (
    <img
      src={src}
      alt="Fluxiflow"
      draggable={false}
      style={{
        height: `${height}px`,
        width: 'auto',
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
};
