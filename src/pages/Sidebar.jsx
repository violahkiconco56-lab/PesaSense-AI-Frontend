import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../api";

function NavIcon({ children }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Sidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="leaf-mark small">P</span>
        <div>
          <h2>PesaSense-AI</h2>
          <p>Smarter Money. Brighter Future.</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard">
          <NavIcon>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </NavIcon>
          Dashboard
        </NavLink>
        <NavLink to="/transactions">
          <NavIcon>
            <path d="M7 8h11l-2.5-2.5M17 16H6l2.5 2.5" />
            <path d="M18 8l-2.5 2.5M6 16l2.5-2.5" />
          </NavIcon>
          Transactions
        </NavLink>
        <NavLink to="/budgets">
          <NavIcon>
            <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M16 12h3v3h-3a1.5 1.5 0 0 1 0-3z" />
          </NavIcon>
          Budgets
        </NavLink>
        <NavLink to="/reports">
          <NavIcon>
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </NavIcon>
          Reports
        </NavLink>
        <NavLink to="/ai">
          <NavIcon>
            <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
            <path d="M18 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
          </NavIcon>
          AI Insights
        </NavLink>
      </nav>

      <button className="logout-button" onClick={handleLogout}>
        <NavIcon>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </NavIcon>
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;
