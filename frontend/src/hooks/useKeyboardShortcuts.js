import { useEffect } from 'react';

/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcuts for common actions
 * 
 * Shortcuts:
 * - A: Acknowledge first active alert
 * - R: Resolve first acknowledged alert
 * - D: Toggle dark mode
 * - M: Mute/unmute alert sounds
 * - /: Focus search (if exists)
 * - Esc: Clear selection/close modals
 * - 1-5: Navigate to different sections
 */

export const useKeyboardShortcuts = (handlers = {}) => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Single key shortcuts
      if (!ctrl && !shift) {
        switch (key) {
          case 'a':
            e.preventDefault();
            handlers.acknowledgeAlert?.();
            break;
          case 'r':
            e.preventDefault();
            handlers.resolveAlert?.();
            break;
          case 'd':
            e.preventDefault();
            handlers.toggleDarkMode?.();
            break;
          case 'm':
            e.preventDefault();
            handlers.toggleMute?.();
            break;
          case '/':
            e.preventDefault();
            handlers.focusSearch?.();
            break;
          case 'escape':
            handlers.clearSelection?.();
            break;
          case '1':
            e.preventDefault();
            handlers.navigateTo?.('/');
            break;
          case '2':
            e.preventDefault();
            handlers.navigateTo?.('/alerts');
            break;
          case '3':
            e.preventDefault();
            handlers.navigateTo?.('/contacts');
            break;
          case '4':
            e.preventDefault();
            handlers.navigateTo?.('/screen-capture');
            break;
          case '5':
            e.preventDefault();
            handlers.navigateTo?.('/system');
            break;
          case '?':
            e.preventDefault();
            handlers.showHelp?.();
            break;
          default:
            break;
        }
      }

      // Ctrl/Cmd shortcuts
      if (ctrl && !shift) {
        switch (key) {
          case 'k':
            e.preventDefault();
            handlers.openCommandPalette?.();
            break;
          case 'e':
            e.preventDefault();
            handlers.exportData?.();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlers]);
};

export default useKeyboardShortcuts;
