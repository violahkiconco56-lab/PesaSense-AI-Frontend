import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { currentMonth, currentYear, formatUGX } from "../utils";

const blankBudget = {
  category: "",
  limit_amount: "",
  month: currentMonth(),
  year: currentYear(),
};

function Budgets() {
  const [performance, setPerformance] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState(blankBudget);
  const [message, setMessage] = useState("");

  async function loadBudgets() {
    const [budgetData, alertData] = await Promise.all([
      apiRequest("/budgets/performance"),
      apiRequest("/budgets/alerts"),
    ]);
    setPerformance(budgetData);
    setAlerts(alertData.alerts || []);
  }

  useEffect(() => {
    loadBudgets().catch((err) => setMessage(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    try {
      await apiRequest("/budgets/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          limit_amount: Number(form.limit_amount),
          month: Number(form.month),
          year: Number(form.year),
        }),
      });
      setForm(blankBudget);
      setMessage("Budget created.");
      await loadBudgets();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page">
          <header className="page-header">
            <div>
              <h1>Budgets</h1>
              <p>Set limits, track your spending, and stay on goal.</p>
            </div>
            <a className="primary-action" href="#category">Create Budget</a>
          </header>

          <section className="summary-grid three">
            <article className="summary-card">
              <span className="card-icon green">B</span>
              <h3>Total Budgeted</h3>
              <p>{formatUGX(performance?.total_budgeted)}</p>
            </article>
            <article className="summary-card">
              <span className="card-icon amber">S</span>
              <h3>Total Spent</h3>
              <p>{formatUGX(performance?.total_spent)}</p>
            </article>
            <article className="summary-card">
              <span className="card-icon teal">R</span>
              <h3>Remaining</h3>
              <p>{formatUGX(performance?.total_remaining)}</p>
              <div className="meter"><span style={{ width: "68%" }} /></div>
            </article>
          </section>

          <section className="content-grid wide-first">
            <article className="budget-card-grid">
              {(performance?.budgets || []).map((budget) => (
                <div className="budget-tile panel" key={budget.budget_id}>
                  <span className="card-icon amber">{budget.category.slice(0, 1)}</span>
                  <h3>{budget.category}</h3>
                  <p>{formatUGX(budget.limit_amount)}</p>
                  <small>Spent: {formatUGX(budget.spent)}</small>
                  <div className="meter">
                    <span
                      className={budget.over_budget ? "danger" : ""}
                      style={{ width: `${Math.min(100, budget.used_percentage)}%` }}
                    />
                  </div>
                  <small>{Math.round(budget.used_percentage)}%</small>
                </div>
              ))}
              {alerts.map((alert) => (
                <div className="budget-alert panel" key={`${alert.budget_id}-${alert.type}`}>
                  <span className="card-icon coral">A</span>
                  <h3>Budget Alert</h3>
                  <p>{alert.message}</p>
                </div>
              ))}
              {performance?.budgets?.length === 0 && <p className="empty-state panel">No budgets yet.</p>}
            </article>

            <article className="panel">
              <div className="section-heading">
                <h2>New Budget</h2>
              </div>
              <form className="stack-form" onSubmit={handleSubmit}>
                <label htmlFor="category">Category</label>
                <input
                  id="category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  required
                />
                <label htmlFor="limit_amount">Limit amount</label>
                <input
                  id="limit_amount"
                  type="number"
                  min="1"
                  value={form.limit_amount}
                  onChange={(event) => setForm({ ...form, limit_amount: event.target.value })}
                  required
                />
                <div className="form-row">
                  <div>
                    <label htmlFor="month">Month</label>
                    <input
                      id="month"
                      type="number"
                      min="1"
                      max="12"
                      value={form.month}
                      onChange={(event) => setForm({ ...form, month: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="year">Year</label>
                    <input
                      id="year"
                      type="number"
                      min="2000"
                      value={form.year}
                      onChange={(event) => setForm({ ...form, year: event.target.value })}
                    />
                  </div>
                </div>
                <button type="submit">Create budget</button>
              </form>
              {message && <p className="form-message">{message}</p>}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Budgets;
