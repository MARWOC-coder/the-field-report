import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const icons = {
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="4" width="6" height="16" />
      <rect x="2" y="10" width="6" height="10" />
      <rect x="16" y="8" width="6" height="12" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M2 20c0-3.3 2.7-6 6-6M22 20c0-3.3-2.7-6-6-6M10 20c0-2 .9-4 2-4s2 2 2 4" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  me: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    </svg>
  ),
};

function Item({ to, label, icon, fab }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item ${fab ? 'log-fab' : ''} ${isActive ? 'on' : ''}`}>
      {fab ? <span className="fab">{icons[icon]}</span> : icons[icon]}
      <span>{label}</span>
    </NavLink>
  );
}

export default function NavBar() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Item to="/board" label="Board" icon="board" />
        <Item to="/team" label="Team" icon="team" />
        <Item to="/" label="Log" icon="log" fab />
        <Item to="/me" label="Me" icon="me" />
        {isAdmin && <Item to="/admin" label="HQ" icon="admin" />}
      </div>
    </nav>
  );
}
