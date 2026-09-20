import { useEffect, useRef, type ReactNode } from 'react';
import { Drawer, DrawerContent } from './drawer';

interface LegacyDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  direction?: 'bottom' | 'right' | 'left';
  className?: string;
}

/** Compatibility frame for legacy page content while its inner markup is normalized. */
export default function LegacyDrawer({ open, onClose, children, direction = 'bottom', className = '' }: LegacyDrawerProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) returnFocusRef.current = active;
    return () => {
      const target = returnFocusRef.current;
      if (!target) return;
      window.requestAnimationFrame(() => {
        if (target.isConnected) target.focus();
        returnFocusRef.current = null;
      });
    };
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }} direction={direction} shouldScaleBackground={false}>
      <DrawerContent className={`legacy-drawer ${className}`}>{children}</DrawerContent>
    </Drawer>
  );
}
