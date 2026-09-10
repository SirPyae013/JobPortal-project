import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, BriefcaseBusiness, GraduationCap, LogOut, Menu, X } from "lucide-react";

export interface NavbarProps {
  isLoggedIn: boolean;
  currentUserName: string;
  profilePhotoUrl?: string;
  userRole: "student" | "recruiter";
  canManageJobs: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onBrowseJobs: () => void;
  onPostJob: () => void;
  onMyProfile: () => void;
  onMyApplications: () => void;
  onAboutClick: () => void;
  onContactClick: () => void;
  onNotifications: () => void;
  unreadCount: number;
  currentPath?: string;
  onRegisterClick?: () => void;
}

export default function Navbar(props: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const recruiter = props.isLoggedIn && props.userRole === "recruiter";

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [menuOpen]);

  const act = (callback: () => void) => () => { setMenuOpen(false); callback(); };
  const links = [
    { label: recruiter ? "Workspace" : "Find a job", callback: props.onBrowseJobs, active: !props.currentPath || props.currentPath === "/" || props.currentPath === "/jobs" },
    ...(props.isLoggedIn && !recruiter ? [
      { label: "My applications", callback: props.onMyApplications, active: false },
      { label: "My profile", callback: props.onMyProfile, active: false },
    ] : []),
    { label: "About us", callback: props.onAboutClick, active: props.currentPath === "/about" },
    { label: "Contact", callback: props.onContactClick, active: props.currentPath === "/contact" },
  ];

  return (
    <header className="cm-header" ref={header}>
      <a className="cm-skip-link" href="#main-content">Skip to content</a>
      <div className="cm-nav cm-container">
        <a href="/jobs" className="cm-brand" onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); act(props.onBrowseJobs)(); } }}>
          <span className="cm-brand-mark"><GraduationCap size={25} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>Job<span className="cm-brand-accent">Portal</span><small>Campus to career</small></span>
        </a>
        <nav className="cm-desktop-links" aria-label="Main navigation">
          {links.map((link) => <button key={link.label} type="button" aria-current={link.active ? "page" : undefined} onClick={act(link.callback)}>{link.label}</button>)}
        </nav>
        <div className="cm-account-actions">
          {props.isLoggedIn ? <>
            {recruiter && props.canManageJobs && <button type="button" className="cm-button cm-primary cm-post-job" onClick={act(props.onPostJob)}><BriefcaseBusiness size={16} aria-hidden="true" />Post a job</button>}
            <button type="button" className="cm-icon-button cm-notifications" onClick={act(props.onNotifications)} aria-label={`Notifications${props.unreadCount ? `, ${props.unreadCount} unread` : ""}`}>
              <Bell size={20} aria-hidden="true" />{props.unreadCount > 0 && <span>{props.unreadCount > 99 ? "99+" : props.unreadCount}</span>}
            </button>
            <div className="cm-account"><span className="cm-avatar">{props.profilePhotoUrl ? <img src={props.profilePhotoUrl} alt="" /> : props.currentUserName.slice(0, 2).toUpperCase()}</span><span className="cm-account-name">{props.currentUserName}<small>{recruiter ? "Recruiter" : "Student"}</small></span></div>
            <button type="button" className="cm-icon-button cm-desktop-logout" onClick={act(props.onLogout)} aria-label="Log out"><LogOut size={18} aria-hidden="true" /></button>
          </> : <>
            <button type="button" className="cm-sign-in" onClick={act(props.onLoginClick)}>Log in</button>
            <button type="button" className="cm-button cm-primary cm-sign-up" onClick={act(props.onRegisterClick || props.onLoginClick)}>Get started <ArrowUpRight size={16} aria-hidden="true" /></button>
          </>}
          <button ref={menuButton} type="button" className="cm-icon-button cm-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="cm-mobile-links" aria-label="Mobile navigation">
        {links.map((link) => <button key={link.label} type="button" aria-current={link.active ? "page" : undefined} onClick={act(link.callback)}>{link.label}</button>)}
        {recruiter && props.canManageJobs && <button type="button" onClick={act(props.onPostJob)}>Post a job</button>}
        {props.isLoggedIn ? <button type="button" onClick={act(props.onLogout)}>Log out</button> : <button type="button" onClick={act(props.onRegisterClick || props.onLoginClick)}>Create an account</button>}
      </nav>}
    </header>
  );
}
