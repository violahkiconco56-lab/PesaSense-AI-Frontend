import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { TRANSACTIONS_CHANGED, formatDate, formatUGX } from "../utils";

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  // Totals are always re-read from the API so income added anywhere (for
  // example through the Budget page modal) shows up immediately.
  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiRequest("/transactions/dashboard/summary");
      setDashboard(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    apiRequest("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, [loadDashboard]);

  // Navigating here from another page re-mounts the route, but a plain
  // browser focus change (returning from another window) should refresh too.
  useEffect(() => {
    window.addEventListener("focus", loadDashboard);
    window.addEventListener(TRANSACTIONS_CHANGED, loadDashboard);
    return () => {
      window.removeEventListener("focus", loadDashboard);
      window.removeEventListener(TRANSACTIONS_CHANGED, loadDashboard);
    };
  }, [loadDashboard]);

  const displayName = user?.username || "there";
  const greeting = greetingForHour(new Date().getHours());
  const today = new Date().toLocaleDateString("en-UG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const budgetUsage =
    dashboard?.total_income > 0
      ? Math.round((dashboard.total_expenses / dashboard.total_income) * 100)
      : 0;

  const recentTransactions = dashboard?.recent_transactions || [];
  const hasTransactions = recentTransactions.length > 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page dashboard-page">
          <header className="page-header">
            <div>
              <h1>
                {greeting}, {displayName}
              </h1>
              <p>Here's what's happening with your finances today.</p>
            </div>
            <span className="date-chip">{today}</span>
          </header>

          {error && <p className="form-message error">{error}</p>}

          {isLoading && <p className="empty-state panel">Loading your dashboard...</p>}

          <section className="summary-grid">
            <article className="summary-card">
              <span className="card-icon green">I</span>
              <h3>Total Income</h3>
              <p>{formatUGX(dashboard?.total_income)}</p>
              <small>12% from last month</small>
            </article>
            <article className="summary-card">
              <span className="card-icon amber">E</span>
              <h3>Total Expenses</h3>
              <p>{formatUGX(dashboard?.total_expenses)}</p>
              <small className="danger-text">8% from last month</small>
            </article>
            <article className="summary-card">
              <span className="card-icon teal">B</span>
              <h3>Balance</h3>
              <p>{formatUGX(dashboard?.balance)}</p>
              <small>15% from last month</small>
            </article>
            <article className="summary-card">
              <span className="card-icon violet">U</span>
              <h3>Budget Usage</h3>
              <p>{Math.max(0, Math.min(100, budgetUsage))}%</p>
              <div className="meter">
                <span style={{ width: `${Math.max(0, Math.min(100, budgetUsage))}%` }} />
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel chart-panel">
              <div className="section-heading row-heading">
                <h2>Spending Overview</h2>
                <select aria-label="Chart range" defaultValue="month">
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
              {hasTransactions ? (
                <>
                  <div className="line-chart" aria-hidden="true">
                    {[25, 34, 42, 57, 50, 64, 58, 76, 55].map((height) => (
                      <span key={height} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <div className="chart-labels">
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((month) => (
                      <span key={month}>{month}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="empty-state chart-empty">Add your first transaction to see spending trends.</p>
              )}
            </article>

            <article className="panel donut-panel">
              <div className="section-heading">
                <h2>Expenses by Category</h2>
              </div>
              {dashboard?.highest_expense_category ? (
                <div className="donut-wrap">
                  <div className="donut"><span>{formatUGX(dashboard?.total_expenses)}</span></div>
                  <div className="legend-list">
                    <span>{dashboard.highest_expense_category}</span>
                  </div>
                </div>
              ) : (
                <p className="empty-state chart-empty">No expense categories yet.</p>
              )}
            </article>

            <article className="panel transactions-panel">
              <div className="section-heading row-heading">
                <h2>Recent Transactions</h2>
                <a href="/transactions">View all</a>
              </div>
              <div className="table-list compact">
                {recentTransactions.map((transaction) => (
                  <div className="table-row" key={transaction.id}>
                    <span className={`type-dot ${transaction.transaction_type}`} />
                    <div>
                      <strong>{transaction.description || transaction.category}</strong>
                      <span>{transaction.category}</span>
                    </div>
                    <span>{formatDate(transaction.date)}</span>
                    <b>{formatUGX(transaction.amount)}</b>
                  </div>
                ))}
                {recentTransactions.length === 0 && <p className="empty-state">No transactions yet.</p>}
              </div>
            </article>

            <article className="growth-card">
              <span className="leaf-mark small">P</span>
              <h2>Small steps today, big dreams tomorrow.</h2>
              <p>Track your spending, build better habits, reach your goals.</p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
