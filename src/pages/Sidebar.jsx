import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>PesaSense-AI</h2>
        <p>Smart money management</p>
      </div>

      <nav className="sidebar-nav">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/transactions">Transactions</Link>
        <Link to="/budgets">Budgets</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/ai">AI Insights</Link>
      </nav>

      <button className="logout-button">
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;