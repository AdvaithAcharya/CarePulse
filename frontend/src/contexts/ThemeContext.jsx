import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const themes = {
  light: {
    name: 'Light',
    class: 'light',
    colors: { primary: 'purple', background: 'white', text: 'gray-900' }
  },
  dark: {
    name: 'Dark',
    class: 'dark',
    colors: { primary: 'purple', background: 'gray-900', text: 'white' }
  },
  ocean: {
    name: 'Ocean',
    class: 'theme-ocean',
    colors: { primary: 'blue', background: 'blue-950', text: 'blue-50' }
  },
  forest: {
    name: 'Forest',
    class: 'theme-forest',
    colors: { primary: 'green', background: 'green-950', text: 'green-50' }
  },
  sunset: {
    name: 'Sunset',
    class: 'theme-sunset',
    colors: { primary: 'orange', background: 'orange-950', text: 'orange-50' }
  },
  midnight: {
    name: 'Midnight',
    class: 'theme-midnight',
    colors: { primary: 'indigo', background: 'indigo-950', text: 'indigo-50' }
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('carepulse-theme');
    return saved || 'light';
  });
  
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('carepulse-font-size') || 'medium';
  });
  
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem('carepulse-high-contrast') === 'true';
  });
  
  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem('carepulse-reduced-motion') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('carepulse-theme', theme);
    const root = document.documentElement;
    
    // Remove all theme classes
    Object.values(themes).forEach(t => root.classList.remove(t.class));
    
    // Add current theme
    root.classList.add(themes[theme]?.class || themes.light.class);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('carepulse-font-size', fontSize);
    const root = document.documentElement;
    root.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl');
    const fontSizeClasses = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
      xlarge: 'text-xl'
    };
    root.classList.add(fontSizeClasses[fontSize] || 'text-base');
  }, [fontSize]);
  
  useEffect(() => {
    localStorage.setItem('carepulse-high-contrast', highContrast);
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);
  
  useEffect(() => {
    localStorage.setItem('carepulse-reduced-motion', reducedMotion);
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      toggleTheme,
      themes,
      fontSize,
      setFontSize,
      highContrast,
      setHighContrast,
      reducedMotion,
      setReducedMotion
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
