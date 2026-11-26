import type { Theme } from './chart/engine';

export type ThemeMode = 'dark' | 'light';

export const CHART_THEMES: Record<ThemeMode, Theme> = {
  dark: {
    bg: '#0c0f15',
    grid: 'rgba(138,147,166,0.07)',
    text: '#8a93a6',
    textStrong: '#e6e9ef',
    border: '#222836',
    crosshair: 'rgba(200,206,220,0.45)',
    crosshairLabel: '#363d4f',
    up: '#26c28b',
    down: '#f0506e',
    accent: '#f0b44c',
    watermark: 'rgba(138,147,166,0.05)',
  },
  light: {
    bg: '#ffffff',
    grid: 'rgba(20,24,33,0.06)',
    text: '#5e6677',
    textStrong: '#141821',
    border: '#e2e5eb',
    crosshair: 'rgba(20,24,33,0.4)',
    crosshairLabel: '#3a4152',
    up: '#12a374',
    down: '#e0425f',
    accent: '#d9932a',
    watermark: 'rgba(20,24,33,0.045)',
  },
};
