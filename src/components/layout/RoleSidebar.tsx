import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAccess } from '../../hooks/queries/useAccess';
import { routeVisible } from '../../config/routeAccess';
import UserAvatar from './UserAvatar';

export type SidebarIcon = ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
export type RoleNavItem = { to: string; label: string; Icon: SidebarIcon };
export type RoleNavEntry = RoleNavItem | { key: string; label: string; Icon: SidebarIcon; children: RoleNavItem[] };
export type RoleNavGroup = { label: string; entries: RoleNavEntry[] };

interface RoleSidebarProps {
  portalKey: string;
  roleLabel: string;
  workspaceLabel: string;
  dashboard: RoleNavItem;
  groups: RoleNavGroup[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  preserveSearch?: boolean;
  feature?: { to: string; eyebrow: string; label: string; Icon: SidebarIcon };
  footerLinks?: RoleNavItem[];
  accountLink?: { to: string; label: string; Icon: SidebarIcon };
  accountLinks?: RoleNavItem[];
}

const isNested = (entry: RoleNavEntry): entry is Extract<RoleNavEntry, { children: RoleNavItem[] }> => 'children' in entry;
const activeParentKeys = (groups: RoleNavGroup[], pathname: string) => groups.flatMap((group) => group.entries)
  .filter(isNested).filter((entry) => entry.children.some((child) => pathname === child.to)).map((entry) => entry.key);

export function SidebarMobileTrigger({ onClick }: { onClick: () => void }) {
  return <button type="button" className="ca-mobile-nav-trigger" onClick={onClick} aria-label="Open navigation"><Menu size={18} aria-hidden /></button>;
}

export default function RoleSidebar({
  portalKey,
  roleLabel,
  workspaceLabel,
  dashboard,
  groups,
  mobileOpen = false,
  onMobileClose,
  preserveSearch = false,
  feature,
  footerLinks = [],
  accountLink,
  accountLinks,
}: RoleSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const access = useAccess();
  const sidebarRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDetailsElement>(null);
  const storageKey = `vook-sidebar-collapsed-${portalKey}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === 'true');
  const [openMenus, setOpenMenus] = useState<string[]>(() => activeParentKeys(groups, location.pathname));

  useEffect(() => {
    const parents = activeParentKeys(groups, location.pathname);
    if (parents.length) setOpenMenus((current) => [...new Set([...current, ...parents])]);
  }, [groups, location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose?.();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    sidebarRef.current?.querySelector<HTMLButtonElement>('.ca-sidebar-mobile-close')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    const closeUserMenuOnOutsidePointer = (event: PointerEvent) => {
      const menu = userMenuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.removeAttribute('open');
    };
    const closeUserMenuOnEscape = (event: KeyboardEvent) => {
      const menu = userMenuRef.current;
      if (event.key === 'Escape' && menu?.open) {
        menu.removeAttribute('open');
        menu.querySelector<HTMLElement>('summary')?.focus();
      }
    };

    document.addEventListener('pointerdown', closeUserMenuOnOutsidePointer);
    document.addEventListener('keydown', closeUserMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeUserMenuOnOutsidePointer);
      document.removeEventListener('keydown', closeUserMenuOnEscape);
    };
  }, []);

  const linkTo = (path: string) => preserveSearch && location.search
    ? { pathname: path, search: location.search }
    : path;
  const visible = (item: RoleNavItem) => routeVisible(access, item.to);
  const menuAccountLinks = accountLinks ?? (accountLink ? [accountLink] : []);
  const toggleCollapsed = () => setCollapsed((current) => {
    localStorage.setItem(storageKey, String(!current));
    return !current;
  });
  const toggleMenu = (key: string) => {
    if (collapsed && window.innerWidth > 768) {
      setCollapsed(false);
      localStorage.setItem(storageKey, 'false');
      setOpenMenus((current) => [...new Set([...current, key])]);
      return;
    }
    setOpenMenus((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  const closeUserMenu = (event: React.MouseEvent<HTMLElement>) => event.currentTarget.closest('details')?.removeAttribute('open');

  return <>
    <button type="button" className={`ca-sidebar-backdrop${mobileOpen ? ' is-visible' : ''}`} aria-label="Close navigation" onClick={onMobileClose} />
    <aside ref={sidebarRef} className={`ca-sidebar role-sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}>
      <div className="sidebar-brand"><div>V</div><span><strong>VOOK</strong><small>{workspaceLabel}</small></span><button type="button" className="ca-sidebar-mobile-close" onClick={onMobileClose} aria-label="Close navigation"><X size={18} aria-hidden /></button></div>
      <nav aria-label={`${roleLabel} navigation`}>
        {visible(dashboard) && <NavLink to={linkTo(dashboard.to)} onClick={onMobileClose} title={collapsed ? dashboard.label : undefined} data-tooltip={dashboard.label} className={({ isActive }) => `ca-nav-link ca-nav-link--dashboard${isActive ? ' is-active' : ''}`}><dashboard.Icon size={17} aria-hidden /><span>{dashboard.label}</span></NavLink>}
        {feature && visible(feature) && <NavLink to={linkTo(feature.to)} onClick={onMobileClose} className={({ isActive }) => `ca-setup-card${isActive ? ' is-active' : ''}`}><feature.Icon size={17} aria-hidden /><span><small>{feature.eyebrow}</small><strong>{feature.label}</strong></span></NavLink>}
        {groups.map((group) => {
          const entries = group.entries.flatMap((entry): RoleNavEntry[] => {
            if (!isNested(entry)) return visible(entry) ? [entry] : [];
            const children = entry.children.filter(visible);
            return children.length ? [{ ...entry, children }] : [];
          });
          if (!entries.length) return null;
          return <section key={group.label}><p>{group.label}</p>{entries.map((entry) => {
            if (!isNested(entry)) return <NavLink key={entry.to} to={linkTo(entry.to)} onClick={onMobileClose} title={collapsed ? entry.label : undefined} data-tooltip={entry.label} className={({ isActive }) => `ca-nav-link${isActive ? ' is-active' : ''}`}><entry.Icon size={17} aria-hidden /><span>{entry.label}</span></NavLink>;
            const isOpen = openMenus.includes(entry.key);
            const isActive = entry.children.some((child) => location.pathname === child.to);
            return <div className={`ca-nav-tree${isOpen ? ' is-open' : ''}`} key={entry.key}>
              <button type="button" className={`ca-nav-parent${isActive ? ' is-active' : ''}`} aria-expanded={isOpen} aria-controls={`${portalKey}-submenu-${entry.key}`} title={collapsed ? entry.label : undefined} data-tooltip={entry.label} onClick={() => toggleMenu(entry.key)}><entry.Icon size={17} aria-hidden /><span>{entry.label}</span><ChevronDown className="ca-nav-chevron" size={14} aria-hidden /></button>
              <div className="ca-nav-submenu" id={`${portalKey}-submenu-${entry.key}`}>{entry.children.map((child) => <NavLink key={child.to} to={linkTo(child.to)} onClick={onMobileClose} className={({ isActive: childActive }) => childActive ? 'is-active' : ''}><span>{child.label}</span></NavLink>)}</div>
            </div>;
          })}</section>;
        })}
      </nav>
      <div className="sidebar-user">
        {footerLinks.filter(visible).map((item) => <NavLink key={item.to} to={linkTo(item.to)} onClick={onMobileClose} title={collapsed ? item.label : undefined} data-tooltip={item.label} className={({ isActive }) => `ca-nav-link${isActive ? ' is-active' : ''}`}><item.Icon size={17} aria-hidden /><span>{item.label}</span></NavLink>)}
        <details ref={userMenuRef} className="ca-user-menu"><summary title={collapsed ? user?.name : undefined} data-tooltip={user?.name ?? 'Account'}><UserAvatar user={user} name={user?.name ?? roleLabel} size={30} className="ca-user-avatar" /><span className="ca-user-copy"><strong>{user?.name}</strong><small>{roleLabel}</small></span><ChevronDown className="ca-user-chevron" size={14} aria-hidden /></summary><div className="ca-user-menu__popover">{menuAccountLinks.map((item) => <NavLink key={item.to} to={linkTo(item.to)} onClick={(event) => { closeUserMenu(event); onMobileClose?.(); }}><item.Icon size={15} aria-hidden /> {item.label}</NavLink>)}<button onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={15} aria-hidden /> Sign out</button></div></details>
      </div>
      <button type="button" className="ca-sidebar-rail" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? <PanelLeftOpen size={15} aria-hidden /> : <PanelLeftClose size={15} aria-hidden />}</button>
    </aside>
  </>;
}
