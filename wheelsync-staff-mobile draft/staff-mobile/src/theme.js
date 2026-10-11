// Shared design tokens for the WheelSync staff app.
// Same "galaxy" palette family used on the admin/customer web apps —
// light mode is a lifted-tint version of dark mode, never a plain invert.

export const darkTheme = {
  mode: 'dark',
  bgVoid: '#07071a',
  bgDeep: '#0b0b22',
  bgSurface: '#14142f',
  bgSurface2: '#1b1b3d',
  border: 'rgba(166, 163, 201, 0.16)',
  textPrimary: '#f1f0fa',
  textMuted: '#a6a3c9',
  textFaint: '#6f6b96',
  nebula1: '#6c4ff0',
  nebula2: '#9b5de5',
  nebula3: '#4f7cff',
  starGold: '#f5c542',
  success: '#4ade80',
  danger: '#fb7185',
  warning: '#fbbf24',
  gradient: ['#6c4ff0', '#9b5de5', '#4f7cff'],
}

export const lightTheme = {
  mode: 'light',
  bgVoid: '#f3f1fc',
  bgDeep: '#f7f6fd',
  bgSurface: '#ffffff',
  bgSurface2: '#ece9fb',
  border: 'rgba(98, 94, 130, 0.14)',
  textPrimary: '#1e1b3a',
  textMuted: '#625e82',
  textFaint: '#918dae',
  nebula1: '#8f7bf7',
  nebula2: '#b591ee',
  nebula3: '#8fb4ff',
  starGold: '#e0ab1f',
  success: '#16a34a',
  danger: '#e11d48',
  warning: '#d97706',
  gradient: ['#8f7bf7', '#b591ee', '#8fb4ff'],
}

export const radius = { sm: 10, md: 16, lg: 24 }
