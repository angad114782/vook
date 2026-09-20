import { useEffect, useRef, type ReactNode } from 'react';
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
  const direction = placement === 'responsive' ? (desktop ? 'right' : 'bottom') : placement;
  const sideClass = placement === 'bottom' || (!desktop && placement === 'responsive')
    ? 'app-drawer--bottom'
    : `app-drawer--${direction}`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={direction} shouldScaleBackground={false}>
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
