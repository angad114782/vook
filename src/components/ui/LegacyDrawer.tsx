import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Drawer, DrawerContent } from './drawer';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const DRAWER_EXIT_DURATION = 500;

interface LegacyDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  direction?: 'bottom' | 'right' | 'left';
  className?: string;
}

/** Compatibility frame for legacy page content while its inner markup is normalized. */
export default function LegacyDrawer({ open, onClose, children, direction = 'bottom', className = '' }: LegacyDrawerProps) {
  const compact = useMediaQuery('(max-width: 1199px)');
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renderOpen, setRenderOpen] = useState(open);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setRenderOpen(open);
  }, [open]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

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

  const handleOpenChange = (nextOpen: boolean) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (nextOpen) {
      setRenderOpen(true);
      return;
    }

    setRenderOpen(false);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, DRAWER_EXIT_DURATION);
  };

  const actualDirection = compact && direction === 'right' ? 'bottom' : direction;

  return (
    <Drawer open={renderOpen} onOpenChange={handleOpenChange} direction={actualDirection} shouldScaleBackground={false}>
      <DrawerContent className={`legacy-drawer ${className}`}>{children}</DrawerContent>
    </Drawer>
  );
}
