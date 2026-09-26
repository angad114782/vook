import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import NotificationBell from "../notifications/NotificationBell";
import GlobalSearch from "../search/GlobalSearch";
import { SidebarMobileTrigger } from "./RoleSidebar";
import UserAvatar from "./UserAvatar";

interface TopBarProps {
  onOpenNavigation?: () => void;
  roleLabel?: string;
  profilePath?: string;
  contextLabel?: string;
  supportPath?: string;
  inboxPath?: string;
}

export default function TopBar({
  onOpenNavigation,
  roleLabel = "Super Admin",
  profilePath = "/profile",
  contextLabel,
  supportPath = "/support",
  inboxPath = "/notifications",
}: TopBarProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="app-topbar">
      <div className="app-topbar__leading">
        {onOpenNavigation && (
          <SidebarMobileTrigger onClick={onOpenNavigation} />
        )}
        <GlobalSearch />
      </div>
      <div className="app-topbar__actions">
        {contextLabel && (
          <span className="app-topbar__context">{contextLabel}</span>
        )}

        <NotificationBell supportPath={supportPath} inboxPath={inboxPath} />
        <button
          type="button"
          className="app-topbar__profile"
          onClick={() => navigate(profilePath)}
          aria-label={`Open ${roleLabel} profile`}
        >
          <UserAvatar user={user} size={32} style={{ borderRadius: "50%" }} />
          <div className="app-topbar__profile-copy">
            <p>{user?.name}</p>
            <span>{roleLabel}</span>
          </div>
        </button>
      </div>
    </header>
  );
}
