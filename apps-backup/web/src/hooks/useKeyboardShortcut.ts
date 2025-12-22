import { useEffect } from "react";

interface UseKeyboardShortcutOptions {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  enabled?: boolean;
}

export const useKeyboardShortcut = (
  { key, ctrlKey = false, shiftKey = false, altKey = false, enabled = true }: UseKeyboardShortcutOptions,
  callback: () => void
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesCtrl = ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const matchesShift = shiftKey ? event.shiftKey : !event.shiftKey;
      const matchesAlt = altKey ? event.altKey : !event.altKey;

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, ctrlKey, shiftKey, altKey, enabled, callback]);
};
