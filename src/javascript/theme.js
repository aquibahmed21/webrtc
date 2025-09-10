// theme.js - Theme customization system
export const themes = {
  default: {
    name: 'Default',
    colors: {
      '--bg-primary': '#0f2027',
      '--bg-secondary': '#203a43',
      '--bg-tertiary': '#2c5364',
      '--bg-panel': 'rgba(255, 255, 255, 0.05)',
      '--text-primary': '#ffffff',
      '--border-primary': 'rgba(255, 255, 255, 0.15)'
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      '--bg-primary': '#0b0b0b',
      '--bg-secondary': '#1a1a1a',
      '--bg-tertiary': '#2d2d2d',
      '--text-primary': '#ffffff',
      '--border-primary': 'rgba(255, 255, 255, 0.1)'
    }
  },
  light: {
    name: 'Light',
    colors: {
      '--bg-primary': '#f8fafc',
      '--bg-secondary': '#e2e8f0',
      '--bg-tertiary': '#cbd5e1',
      '--text-primary': '#1e293b',
      '--border-primary': 'rgba(0, 0, 0, 0.1)'
    }
  },
  darkcyan: {
    name: 'Dark Cyan',
    colors: {
      '--bg-primary': '#052b2b',
      '--bg-secondary': '#074040',
      '--bg-tertiary': '#0b5a5a',
      '--text-primary': '#ffffff',
      '--border-primary': 'rgba(255, 255, 255, 0.15)'
    }
  }
};

export function applyTheme(themeName) {
  // Backward compatibility: map old 'purple' to 'darkcyan'
  if (themeName === 'purple') themeName = 'darkcyan';
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
  const saved = localStorage.getItem('selectedTheme') || 'default';
  return saved === 'purple' ? 'darkcyan' : saved;
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
