import React from 'react';
import { useAppTheme } from '../../context/ThemeContext';

interface FluxiflowLogoProps {
  /** Height in pixels. Defaults to 60. */
  height?: number;
}

/**
 * Theme-aware Fluxiflow logo.
 *
 * - Light theme  → /Fluxiflow logo black.png
 * - Dark theme   → /Fluxiflow logo white.png
 * - System theme → resolved automatically via ThemeContext
 *
 * Uses files from frontend/public/ via Vite's public asset path.
 * Do NOT use CSS filter/invert — the two source images are used directly.
 */
export const FluxiflowLogo: React.FC<FluxiflowLogoProps> = ({ height = 60 }) => {
  const { isDark } = useAppTheme();
  // NOTE: 'Fluxiflow logo black.png' is the white logo (for dark background)
  // and 'Fluxiflow logo white.png' is the black logo (for light background).
  const src = isDark
    ? '/Fluxiflow%20logo%20black.png'
    : '/Fluxiflow%20logo%20white.png';
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
