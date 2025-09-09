// theme.js - Theme customization system
export const themes = {
  default: {
    name: 'Default',
    colors: {
      '--bg-primary': '#0f2027',
      '--bg-secondary': '#203a43',
      '--bg-tertiary': '#2c5364',
      '--bg-panel': 'rgba(255, 255, 255, 0.05)',
      '--bg-card': 'rgba(0, 0, 0, 0.2)',
      '--bg-button': '#1e90ff',
      '--bg-button-hover': '#3ea0ff',
      '--bg-success': '#16a34a',
      '--bg-warning': '#f59e0b',
      '--bg-error': '#dc2626',
      '--bg-info': '#17a2b8',
      '--text-primary': '#fff',
      '--text-secondary': '#ddd',
      '--text-muted': '#bbb',
      '--border-primary': 'rgba(255, 255, 255, 0.15)',
      '--border-success': '#4ade80'
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#1a1a1a',
      '--bg-tertiary': '#2d2d2d',
      '--bg-panel': 'rgba(255, 255, 255, 0.03)',
      '--bg-card': 'rgba(0, 0, 0, 0.4)',
      '--bg-button': '#6366f1',
      '--bg-button-hover': '#818cf8',
      '--bg-success': '#10b981',
      '--bg-warning': '#f59e0b',
      '--bg-error': '#ef4444',
      '--bg-info': '#06b6d4',
      '--text-primary': '#ffffff',
      '--text-secondary': '#e5e7eb',
      '--text-muted': '#9ca3af',
      '--border-primary': 'rgba(255, 255, 255, 0.1)',
      '--border-success': '#10b981'
    }
  },
  light: {
    name: 'Light',
    colors: {
      '--bg-primary': '#f8fafc',
      '--bg-secondary': '#e2e8f0',
      '--bg-tertiary': '#cbd5e1',
      '--bg-panel': 'rgba(0, 0, 0, 0.05)',
      '--bg-card': 'rgba(255, 255, 255, 0.8)',
      '--bg-button': '#3b82f6',
      '--bg-button-hover': '#2563eb',
      '--bg-success': '#059669',
      '--bg-warning': '#d97706',
      '--bg-error': '#dc2626',
      '--bg-info': '#0891b2',
      '--text-primary': '#1e293b',
      '--text-secondary': '#475569',
      '--text-muted': '#64748b',
      '--border-primary': 'rgba(0, 0, 0, 0.1)',
      '--border-success': '#059669'
    }
  },
  purple: {
    name: 'Purple',
    colors: {
      '--bg-primary': '#1e1b4b',
      '--bg-secondary': '#312e81',
      '--bg-tertiary': '#4338ca',
      '--bg-panel': 'rgba(255, 255, 255, 0.05)',
      '--bg-card': 'rgba(0, 0, 0, 0.2)',
      '--bg-button': '#8b5cf6',
      '--bg-button-hover': '#a78bfa',
      '--bg-success': '#10b981',
      '--bg-warning': '#f59e0b',
      '--bg-error': '#ef4444',
      '--bg-info': '#06b6d4',
      '--text-primary': '#ffffff',
      '--text-secondary': '#e0e7ff',
      '--text-muted': '#c7d2fe',
      '--border-primary': 'rgba(255, 255, 255, 0.15)',
      '--border-success': '#10b981'
    }
  }
};

export function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Save to localStorage
  localStorage.setItem('selectedTheme', themeName);
}

export function getCurrentTheme() {
  return localStorage.getItem('selectedTheme') || 'default';
}

export function initializeTheme() {
  const savedTheme = getCurrentTheme();
  applyTheme(savedTheme);
  return savedTheme;
}

export function createThemeSelector() {
  const selector = document.createElement('div');
  selector.id = 'themeSelector';
  selector.innerHTML = `
    <label for="themeSelect">Theme:</label>
    <select id="themeSelect">
      ${Object.entries(themes).map(([key, theme]) => 
        `<option value="${key}">${theme.name}</option>`
      ).join('')}
    </select>
  `;
  
  const select = selector.querySelector('#themeSelect');
  select.value = getCurrentTheme();
  
  select.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
  
  return selector;
}
