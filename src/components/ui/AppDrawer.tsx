import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
} from './drawer';

export type AppDrawerPlacement = 'responsive' | 'right' | 'left' | 'bottom';
export type AppDrawerSize = 'sm' | 'md' | 'lg' | 'xl';

const DRAWER_EXIT_DURATION = 500;

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  placement?: AppDrawerPlacement;
  size?: AppDrawerSize;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
}

export default function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  placement = 'responsive',
  size = 'md',
  closeLabel = 'Close',
  className = '',
  contentClassName = '',
}: AppDrawerProps) {
  const desktop = useMediaQuery('(min-width: 1200px)');
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
      onOpenChange(true);
      return;
    }

    setRenderOpen(false);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onOpenChange(false);
    }, DRAWER_EXIT_DURATION);
  };

  const direction = placement === 'responsive' ? (desktop ? 'right' : 'bottom') : placement;
  const sideClass = placement === 'bottom' || (!desktop && placement === 'responsive')
    ? 'app-drawer--bottom'
    : `app-drawer--${direction}`;

  return (
    <Drawer open={renderOpen} onOpenChange={handleOpenChange} direction={direction} shouldScaleBackground={false}>
      <DrawerContent className={`app-drawer ${sideClass} app-drawer--${size} ${className}`}>
        {direction === 'bottom' && <DrawerHandle className="app-drawer__handle" />}
        <DrawerHeader className="app-drawer__header">
          <div>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </div>
          <DrawerClose className="app-drawer__close" aria-label={closeLabel}>
            <X size={18} aria-hidden />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className={`app-drawer__body ${contentClassName}`}>{children}</DrawerBody>
        {footer && <DrawerFooter className="app-drawer__footer">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}
