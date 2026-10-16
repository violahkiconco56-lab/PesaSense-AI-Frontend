import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AddIncomeModal from "../components/AddIncomeModal";
import { apiRequest } from "../api";
import { TRANSACTIONS_CHANGED, currentMonth, currentYear, formatUGX } from "../utils";
import { FREQUENCY_LABELS, emptyIncomeSummary } from "../income";

const blankBudget = {
  category: "",
  limit_amount: "",
  month: currentMonth(),
  year: currentYear(),
};

// % of a budget used that counts as "watch this".
const WATCH_THRESHOLD = 80;

function paceFor(percentage) {
  if (percentage > 100) return { tone: "danger", label: "Over budget" };
  if (percentage >= WATCH_THRESHOLD) return { tone: "warn", label: "Close to limit" };
  return { tone: "good", label: "On track" };
}

function Budgets() {
  const [overview, setOverview] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState(blankBudget);
  const [message, setMessage] = useState("");
  const [isMessageError, setIsMessageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [recentIncome, setRecentIncome] = useState([]);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Every figure on this page comes from the existing APIs: income and expense
  // totals from the dashboard summary, spending budgets from budget
  // performance, and the latest income rows for context.
  const loadBudgets = useCallback(async () => {
    setLoadError("");
    try {
      const [summary, budgetData, alertData, incomeSummary] = await Promise.all([
        apiRequest("/transactions/dashboard/summary"),
        apiRequest("/budgets/performance"),
        apiRequest("/budgets/alerts"),
        apiRequest("/transactions/income/summary"),
      ]);

      if (!isMounted.current) return;

      setOverview({
        totalIncome: summary?.total_income ?? 0,
        totalExpenses: summary?.total_expenses ?? 0,
        balance: summary?.balance ?? 0,
        income: { ...emptyIncomeSummary, ...(incomeSummary || {}) },
      });
      setPerformance(budgetData);
      setAlerts(alertData?.alerts || []);
      setRecentIncome(
        (summary?.recent_transactions || []).filter(
          (transaction) => transaction.transaction_type === "income",
        ),
      );
    } catch (error) {
      if (isMounted.current) setLoadError(error.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  // Returning from another tab (e.g. after adding a transaction elsewhere)
  // should show fresh numbers.
  useEffect(() => {
    function handleFocus() {
      loadBudgets();
    }
    window.addEventListener("focus", handleFocus);
    window.addEventListener(TRANSACTIONS_CHANGED, handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(TRANSACTIONS_CHANGED, handleFocus);
    };
  }, [loadBudgets]);

  async function handleIncomeSaved() {
    await loadBudgets();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsMessageError(false);
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
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message);
    }
  }

  const totalIncome = overview?.totalIncome ?? 0;
  const totalExpenses = overview?.totalExpenses ?? 0;
  const balance = overview?.balance ?? 0;

  // Spending budgets cover the current month, so the share of monthly income
  // they consume is the honest "available" figure we can show.
  const monthlyIncome = overview?.income?.monthly_income ?? 0;
  const totalBudgeted = performance?.total_budgeted ?? 0;
  const totalSpentOnBudgets = performance?.total_spent ?? 0;
  const unallocatedFromMonthly = monthlyIncome - totalBudgeted;
  const budgetUsage =
    totalBudgeted > 0 ? Math.min(100, (totalSpentOnBudgets / totalBudgeted) * 100) : 0;

  const budgets = performance?.budgets || [];
  const overBudgetCount = budgets.filter((budget) => budget.over_budget).length;
  const sourceBreakdown = Object.entries(overview?.income?.source_totals || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxSourceTotal = sourceBreakdown.length ? sourceBreakdown[0][1] : 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page">
          <header className="page-header">
            <div>
              <h1>Budgets</h1>
              <p>Add what you earn, plan what you spend, and see what is left.</p>
            </div>
            <button type="button" className="primary-action" onClick={() => setShowIncomeModal(true)}>
              + Add Income
            </button>
          </header>

          {loadError && <p className="form-message error">{loadError}</p>}

          {isLoading ? (
            <>
              <section className="summary-grid four">
                {[0, 1, 2, 3].map((key) => (
                  <article className="summary-card skeleton" key={key}>
                    <span className="skeleton-line short" />
                    <span className="skeleton-line tall" />
                    <span className="skeleton-line" />
                  </article>
                ))}
              </section>
              <p className="empty-state panel">Loading your money picture...</p>
            </>
          ) : (
            <>
              <section className="summary-grid four">
                <article className="summary-card">
                  <span className="card-icon green">I</span>
                  <h3>Total Income</h3>
                  <p>{formatUGX(totalIncome)}</p>
                  <small>
                    {overview?.income?.income_count ?? 0} entr
                    {(overview?.income?.income_count ?? 0) === 1 ? "y" : "ies"} recorded
                  </small>
                </article>
                <article className="summary-card">
                  <span className="card-icon amber">E</span>
                  <h3>Total Expenses</h3>
                  <p>{formatUGX(totalExpenses)}</p>
                  <small className="danger-text">Recorded spending</small>
                </article>
                <article className="summary-card">
                  <span className="card-icon teal">B</span>
                  <h3>Available Balance</h3>
                  <p>{formatUGX(balance)}</p>
                  <small>Income minus expenses</small>
                </article>
                <article className="summary-card">
                  <span className="card-icon violet">M</span>
                  <h3>Est. Monthly Income</h3>
                  <p>{formatUGX(monthlyIncome)}</p>
                  <small>Includes recurring income</small>
                </article>
              </section>

              <section className="budget-overview panel">
                <div className="section-heading row-heading">
                  <div>
                    <h2>Where your money stands</h2>
                    <p>Spending budgets are separate from the income you record.</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setShowBudgetForm((open) => !open)}
                  >
                    {showBudgetForm ? "Hide budget form" : "+ New Budget"}
                  </button>
                </div>

                <div className="overview-split">
                  <div className="overview-figures">
                    <div className="figure-row">
                      <span>Set aside for budgets</span>
                      <strong>{formatUGX(totalBudgeted)}</strong>
                    </div>
                    <div className="figure-row">
                      <span>Left after budgeting</span>
                      <strong className={unallocatedFromMonthly < 0 ? "danger-text" : "positive-text"}>
                        {formatUGX(unallocatedFromMonthly)}
                      </strong>
                    </div>
                    <div className="figure-row">
                      <span>Spent of budgeted</span>
                      <strong>{formatUGX(totalSpentOnBudgets)}</strong>
                    </div>
                    <div className="figure-row emphasis">
                      <span>Remaining in budgets</span>
                      <strong>{formatUGX(performance?.total_remaining)}</strong>
                    </div>
                    {unallocatedFromMonthly < 0 && (
                      <p className="overview-hint">
                        Your total budgets are larger than your monthly income.
                      </p>
                    )}
                  </div>

                  <div className="overview-gauge">
                    <div className="gauge-head">
                      <span>Overall progress</span>
                      <strong>{Math.round(budgetUsage)}%</strong>
                    </div>
                    <div className="meter large">
                      <span style={{ width: `${budgetUsage}%` }} />
                    </div>
                    <p className="gauge-caption">
                      {budgets.length === 0
                        ? "No budgets yet - add one to start tracking."
                        : `${budgets.length} budget${budgets.length === 1 ? "" : "s"}${
                            overBudgetCount > 0
                              ? ` \u00b7 ${overBudgetCount} over limit`
                              : " \u00b7 all within limit"
                          }`}
                    </p>

                    {sourceBreakdown.length > 0 && (
                      <div className="source-breakdown">
                        <span className="block-label">Top income sources</span>
                        {sourceBreakdown.map(([source, total]) => (
                          <div className="source-row" key={source}>
                            <span>{source}</span>
                            <div className="source-bar">
                              <span
                                style={{
                                  width: `${
                                    maxSourceTotal > 0
                                      ? Math.round((total / maxSourceTotal) * 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <strong>{formatUGX(total)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="overview-recent">
                    <span className="block-label">Latest income</span>
                    {recentIncome.length > 0 ? (
                      recentIncome.slice(0, 4).map((transaction) => (
                        <div className="recent-income-row" key={transaction.id}>
                          <div>
                            <strong>{transaction.description || transaction.category}</strong>
                            <span>
                              {transaction.category}
                              {transaction.frequency
                                ? ` \u00b7 ${
                                    FREQUENCY_LABELS[transaction.frequency] || transaction.frequency
                                  }`
                                : ""}
                            </span>
                          </div>
                          <b>{formatUGX(transaction.amount)}</b>
                        </div>
                      ))
                    ) : (
                      <p className="empty-state small-empty">
                        Nothing recorded yet. Use <strong>+ Add Income</strong> to log what you earned.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="content-grid wide-first">
                <article className="panel">
                  <div className="section-heading row-heading">
                    <div>
                      <h2>Spending Budgets</h2>
                      <p>
                        Month {currentMonth()}/{currentYear()} - limits you set, checked against real
                        spending.
                      </p>
                    </div>
                  </div>

                  {budgets.length === 0 ? (
                    <p className="empty-state">
                      No budgets yet. Create one to track spending against a limit.
                    </p>
                  ) : (
                    <div className="budget-list" style={{ overflowX: "auto" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(140px, 2fr) 1fr 1fr 1fr auto",
                          gap: "12px",
                          padding: "8px 4px",
                          fontSize: "13px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          opacity: 0.65,
                        }}
                      >
                        <span>Category</span>
                        <span>Budget</span>
                        <span>Spent</span>
                        <span>Remaining</span>
                        <span>Status</span>
                      </div>
                      {budgets.map((budget) => {
                        const pace = paceFor(budget.used_percentage);
                        const barWidth = Math.max(0, Math.min(100, budget.used_percentage));
                        return (
                          <div
                            key={budget.budget_id}
                            style={{ padding: "12px 4px", borderTop: "1px solid #e3e6e4" }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(140px, 2fr) 1fr 1fr 1fr auto",
                                gap: "12px",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <strong>{budget.category}</strong>
                                <br />
                                <small>
                                  {budget.month}/{budget.year} · {Math.round(budget.used_percentage)}% used
                                </small>
                              </div>
                              <span>{formatUGX(budget.limit_amount)}</span>
                              <span>{formatUGX(budget.spent)}</span>
                              <strong
                                className={budget.remaining < 0 ? "danger-text" : "positive-text"}
                              >
                                {formatUGX(budget.remaining)}
                              </strong>
                              <span className={`pace-pill ${pace.tone}`}>{pace.label}</span>
                            </div>
                            <div className="meter" style={{ marginTop: "8px" }}>
                              <span
                                className={
                                  pace.tone === "danger" ? "danger" : pace.tone === "warn" ? "warn" : ""
                                }
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {alerts.length > 0 && (
                    <div className="alert-list">
                      {alerts.map((alert) => (
                        <div
                          className={`alert-row${alert.over_budget ? " severe" : ""}`}
                          key={`${alert.budget_id}-${alert.type}`}
                        >
                          <span>{alert.category}</span>
                          <p>{alert.message}</p>
                          <strong>{formatUGX(alert.remaining)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="panel">
                  {showBudgetForm ? (
                    <>
                      <div className="section-heading">
                        <h2>New Budget</h2>
                        <p>Spending limits only - add income from the button above.</p>
                      </div>
                      <form className="stack-form" onSubmit={handleSubmit}>
                        <label htmlFor="category">Category</label>
                        <input
                          id="category"
                          placeholder="e.g. Food"
                          value={form.category}
                          onChange={(event) => setForm({ ...form, category: event.target.value })}
                          required
                        />
                        <label htmlFor="limit_amount">Limit amount (UGX)</label>
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
                    </>
                  ) : (
                    <>
                      <div className="section-heading">
                        <h2>An example</h2>
                        <p>How PesaSense keeps income separate from spending budgets.</p>
                      </div>
                      <div className="example-stack">
                        <div className="example-row income-line">
                          <span>Income</span>
                          <strong>UGX 500,000</strong>
                        </div>
                        <div className="example-row">
                          <span>Food budget</span>
                          <strong>UGX 100,000</strong>
                        </div>
                        <div className="example-row">
                          <span>Food spent</span>
                          <strong>UGX 65,000</strong>
                        </div>
                        <div className="example-row highlight">
                          <span>Food remaining</span>
                          <strong>UGX 35,000</strong>
                        </div>
                      </div>
                      <p className="overview-hint">
                        Income is never mixed into a budget - it simply decides how much you plan to
                        set aside.
                      </p>
                    </>
                  )}

                  {message && (
                    <p className={`form-message${isMessageError ? " error" : " success"}`}>
                      {message}
                    </p>
                  )}
                </article>
              </section>
            </>
          )}
        </main>
      </div>

      {showIncomeModal && (
        <AddIncomeModal onClose={() => setShowIncomeModal(false)} onSaved={handleIncomeSaved} />
      )}
    </div>
  );
}

export default Budgets;