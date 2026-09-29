import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import '../../styles/theme-toggle.css';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      <div className="theme-toggle__track">
        {/* Animated thumb */}
        <motion.div
          className="theme-toggle__thumb"
          layout
          initial={false}
          animate={{
            x: isDark ? '100%' : '0%',
            opacity: 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
        />
        
        {/* Sun Icon */}
        <div className="theme-toggle__icon-container">
          <Sun
            size={14}
            strokeWidth={2.5}
            className={`theme-toggle__icon ${!isDark ? 'theme-toggle__icon--active' : 'theme-toggle__icon--inactive'}`}
          />
        </div>
        
        {/* Moon Icon */}
        <div className="theme-toggle__icon-container">
          <Moon
            size={14}
            strokeWidth={2.5}
            className={`theme-toggle__icon ${isDark ? 'theme-toggle__icon--active' : 'theme-toggle__icon--inactive'}`}
          />
        </div>
      </div>
    </button>
  );
}
