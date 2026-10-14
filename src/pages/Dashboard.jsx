import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { TRANSACTIONS_CHANGED, formatDate, formatUGX } from "../utils";

const CATEGORY_COLORS = ["#0b4c35", "#78a95e", "#d8ddb5", "#6d7b5c", "#c9d5bd", "#424940"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function changeText(value) {
  if (value === null || value === undefined) return "No data for last month";
  const arrow = value >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(value)}% vs last month`;
}

function formatOptionalUGX(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return formatUGX(value);
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-UG", { month: "short" });
}

function monthPeriod(key) {
  if (!key) return "this month";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-UG", {
    month: "long",
    year: "numeric",
  });
}

function dueText(bill) {
  if (bill.is_overdue) return `Overdue by ${Math.abs(bill.days_until_due)} day(s)`;
  if (bill.days_until_due === 0) return "Due today";
  if (bill.days_until_due === 1) return "Due tomorrow";
  return `Due in ${bill.days_until_due} days`;
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [trend, setTrend] = useState([]);
  const [goals, setGoals] = useState([]);
  const [bills, setBills] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [predictionError, setPredictionError] = useState("");
  const [dataErrors, setDataErrors] = useState({});
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestInProgress = useRef(false);

  const loadDashboard = useCallback(async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setIsLoading(true);
    setError("");
    setPredictionError("");

    try {
      const [
        summaryRes,
        monthlyRes,
        trendRes,
        goalsRes,
        billsRes,
        predictionsRes,
        userRes,
      ] = await Promise.allSettled([
        apiRequest("/transactions/dashboard/summary"),
        apiRequest("/analytics/monthly"),
        apiRequest("/analytics/trend?months=6"),
        apiRequest("/goals/"),
        apiRequest("/recurring-bills/upcoming?days=30"),
        apiRequest("/analytics/predictions"),
        apiRequest("/users/me"),
      ]);

      const summaryValue =
        summaryRes.status === "fulfilled" &&
        Array.isArray(summaryRes.value?.recent_transactions) &&
        summaryRes.value.recent_transactions.every(isRecord)
          ? summaryRes.value
          : null;
      const monthlyValue =
        monthlyRes.status === "fulfilled" &&
        isRecord(monthlyRes.value?.current) &&
        Array.isArray(monthlyRes.value.current.category_breakdown) &&
        monthlyRes.value.current.category_breakdown.every(isRecord)
          ? monthlyRes.value
          : null;
      const trendValue =
        trendRes.status === "fulfilled" &&
        Array.isArray(trendRes.value) &&
        trendRes.value.every(
          (point) =>
            isRecord(point) &&
            typeof point.month === "string" &&
            isFiniteNumber(point.expenses),
        )
          ? trendRes.value
          : null;
      const goalsValue =
        goalsRes.status === "fulfilled" &&
        Array.isArray(goalsRes.value) &&
        goalsRes.value.every(isRecord)
          ? goalsRes.value
          : null;
      const billsValue =
        billsRes.status === "fulfilled" &&
        Array.isArray(billsRes.value) &&
        billsRes.value.every(isRecord)
          ? billsRes.value
          : null;
      setSummary(summaryValue);
      setMonthly(monthlyValue);
      setTrend(trendValue || []);
      setGoals(goalsValue || []);
      setBills(billsValue || []);
      setUser(userRes.status === "fulfilled" ? userRes.value : null);

      setDataErrors({
        summary: summaryValue
          ? ""
          : summaryRes.status === "rejected"
            ? summaryRes.reason?.message || "Dashboard summary is unavailable."
            : "Dashboard summary is unavailable.",
        monthly: monthlyValue
          ? ""
          : monthlyRes.status === "rejected"
            ? monthlyRes.reason?.message || "Monthly analytics are unavailable."
            : "Monthly analytics are unavailable.",
        trend: trendValue
          ? ""
          : trendRes.status === "rejected"
            ? trendRes.reason?.message || "Spending trend is unavailable."
            : "Spending trend is unavailable.",
        goals: goalsValue
          ? ""
          : goalsRes.status === "rejected"
            ? goalsRes.reason?.message || "Savings goals are unavailable."
            : "Savings goals are unavailable.",
        bills: billsValue
          ? ""
          : billsRes.status === "rejected"
            ? billsRes.reason?.message || "Upcoming bills are unavailable."
            : "Upcoming bills are unavailable.",
      });

      if (summaryValue === null || monthlyValue === null) {
        setError(
          summaryValue === null && monthlyValue === null
            ? "Could not load your dashboard summary or monthly analytics."
            : summaryValue === null
              ? "Dashboard summary is unavailable."
              : "Monthly analytics are unavailable.",
        );
      } else {
        setError("");
      }

      if (
        predictionsRes.status === "fulfilled" &&
        predictionsRes.value &&
        isRecord(predictionsRes.value.forecast) &&
        Array.isArray(predictionsRes.value.budget_risks) &&
        predictionsRes.value.budget_risks.every(isRecord) &&
        Array.isArray(predictionsRes.value.unusual_spending) &&
        predictionsRes.value.unusual_spending.every(isRecord) &&
        isRecord(predictionsRes.value.savings_target)
      ) {
        setPredictions(predictionsRes.value);
      } else {
        setPredictions(null);
        setPredictionError(
          predictionsRes.status === "rejected"
            ? predictionsRes.reason?.message ||
                "Forecast and spending alerts are unavailable."
            : "Forecast and spending alerts are unavailable.",
        );
      }
    } finally {
      requestInProgress.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

  const current = monthly?.current;
  const previous = monthly?.previous;
  const incomeChange = current && previous ? percentChange(current.income, previous.income) : null;
  const expenseChange = monthly?.expense_change_percent ?? null;
  const savingsChange =
    current && previous ? percentChange(current.net_savings, previous.net_savings) : null;
  const savingsRate = current?.savings_rate;
  const forecast = predictions?.forecast;
  const budgetRisks = (predictions?.budget_risks || []).filter(
    (budget) =>
      budget &&
      (budget.status === "at_risk" || budget.status === "exceeded"),
  );
  const unusualSpending = predictions?.unusual_spending || [];
  const savingsTarget = predictions?.savings_target;

  // Spending trend bars
  const maxExpense = Math.max(...trend.map((point) => point.expenses), 0);
  const hasTrend = maxExpense > 0;

  // Category donut
  const breakdown = current?.category_breakdown || [];
  const topCategories = breakdown.slice(0, 5);
  const otherTotal = breakdown.slice(5).reduce((sum, item) => sum + item.total, 0);
  const slices =
    otherTotal > 0 && current?.expenses
      ? [
          ...topCategories,
          {
            category: "Other",
            total: otherTotal,
            percent: Math.round((otherTotal / current.expenses) * 1000) / 10,
          },
        ]
      : topCategories;

  const gradientStops = slices
    .map((slice, index) => {
      const start = slices
        .slice(0, index)
        .reduce((total, previousSlice) => total + previousSlice.percent, 0);
      const end = start + slice.percent;
      return `${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ");

  const recentTransactions = summary?.recent_transactions || [];
  const activeGoals = goals.filter((goal) => !goal.is_completed).slice(0, 3);

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
              <p>Here's how your money is doing this month.</p>
            </div>
            <div className="dashboard-actions">
              <span className="date-chip">{today}</span>
              <button
                className="secondary-button"
                type="button"
                onClick={loadDashboard}
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </header>

          {error && (
            <div className="form-message error dashboard-message">
              <span>{error}</span>
              <button type="button" onClick={loadDashboard} disabled={isLoading}>
                Retry
              </button>
            </div>
          )}
          {isLoading && <p className="empty-state panel">Loading your dashboard...</p>}

          <section className="summary-grid">
            <article className="summary-card">
              <span className="card-icon green">I</span>
              <h3>Income (this month)</h3>
              <p>{formatOptionalUGX(current?.income)}</p>
              <small>{changeText(incomeChange)}</small>
            </article>
            <article className="summary-card">
              <span className="card-icon amber">E</span>
              <h3>Expenses (this month)</h3>
              <p>{formatOptionalUGX(current?.expenses)}</p>
              <small className={expenseChange > 0 ? "danger-text" : ""}>
                {changeText(expenseChange)}
              </small>
            </article>
            <article className="summary-card">
              <span className="card-icon teal">S</span>
              <h3>Net Savings</h3>
              <p>{formatOptionalUGX(current?.net_savings)}</p>
              <small>{changeText(savingsChange)}</small>
            </article>
            <article className="summary-card">
              <span className="card-icon violet">%</span>
              <h3>Savings Rate</h3>
              <p>{savingsRate === null || savingsRate === undefined ? "—" : `${savingsRate}%`}</p>
              <div className="meter">
                <span style={{ width: `${Math.max(0, Math.min(100, savingsRate || 0))}%` }} />
              </div>
            </article>
          </section>

          <section className="dashboard-grid dashboard-insights-grid">
            <article className="panel forecast-panel">
              <div className="section-heading">
                <h2>Month-end forecast</h2>
                <span className="muted-text">{monthPeriod(current?.month)}</span>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading forecast...</p>
              ) : predictionError ? (
                <div className="data-unavailable">
                  <p>{predictionError}</p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={loadDashboard}
                    disabled={isLoading}
                  >
                    Retry forecast
                  </button>
                </div>
              ) : forecast && Number(forecast.spent_so_far) > 0 ? (
                <>
                  <div className="forecast-highlight">
                    <span>Predicted month-end expenses</span>
                    <strong>{formatUGX(forecast.projected_total)}</strong>
                  </div>
                  <div className="forecast-details">
                    <div>
                      <span>Spent so far</span>
                      <strong>{formatUGX(forecast.spent_so_far)}</strong>
                    </div>
                    <div>
                      <span>Daily average</span>
                      <strong>{formatUGX(forecast.daily_average)}</strong>
                    </div>
                    {Number(forecast.income_this_month) > 0 && (
                      <div>
                        <span>Expected month-end net savings*</span>
                        <strong>{formatUGX(forecast.projected_savings)}</strong>
                      </div>
                    )}
                  </div>
                  <p className="data-note">
                    Based on {forecast.days_elapsed} of {forecast.days_in_month} days at the
                    current spending pace. Confidence: {forecast.confidence || "not provided"}.
                    {Number(forecast.income_this_month) > 0
                      ? " *Calculated as this month’s income minus projected expenses; it does not include any opening account balance."
                      : " Net savings projection is unavailable until income is recorded this month."}
                  </p>
                </>
              ) : (
                <p className="empty-state">
                  No expenses are recorded this month yet, so there is not enough spending
                  activity for a useful forecast.
                </p>
              )}
            </article>

            <article className="panel risk-panel">
              <div className="section-heading row-heading">
                <h2>Budget risk alerts</h2>
                <a href="/budgets">Review budgets</a>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading budget risks...</p>
              ) : predictionError ? (
                <p className="data-unavailable">Budget risk analysis is unavailable.</p>
              ) : budgetRisks.length === 0 ? (
                <p className="empty-state">
                  No budgets are currently approaching or over their limits.
                </p>
              ) : (
                <div className="risk-list">
                  {budgetRisks.map((budget) => {
                    const limit = Number(budget.limit);
                    const spent = Number(budget.spent);
                    const percent = Number(budget.percent_used);
                    const remaining = limit - spent;
                    const exceeded = budget.status === "exceeded";
                    return (
                      <div className="risk-item" key={`${budget.category}-${budget.status}`}>
                        <div className="risk-heading">
                          <strong>{budget.category || "Budget"}</strong>
                          <span className={exceeded ? "risk-badge exceeded" : "risk-badge"}>
                            {exceeded ? "Exceeded" : "At risk"}
                          </span>
                        </div>
                        <div className="meter">
                          <span
                            className={exceeded ? "danger" : "warn"}
                            style={{
                              width: `${Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))}%`,
                            }}
                          />
                        </div>
                        <div className="risk-values">
                          <span>
                            {formatUGX(spent)} spent of {formatUGX(limit)}
                          </span>
                          <span>{Number.isFinite(percent) ? `${percent}% used` : "Usage unavailable"}</span>
                        </div>
                        <small className={exceeded ? "danger-text" : "muted-text"}>
                          {exceeded
                            ? `${formatUGX(Math.abs(remaining))} over limit`
                            : `${formatUGX(Math.max(remaining, 0))} remaining`}
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="panel anomaly-panel">
              <div className="section-heading">
                <h2>Unusual spending</h2>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading unusual-spending analysis...</p>
              ) : predictionError ? (
                <p className="data-unavailable">
                  Backend anomaly analysis is unavailable. No detection result is being shown.
                </p>
              ) : unusualSpending.length === 0 ? (
                <p className="empty-state">
                  The backend did not detect unusual spending this month. Transactions without
                  enough category history cannot be assessed.
                </p>
              ) : (
                <div className="risk-list">
                  {unusualSpending.map((alert) => (
                    <div className="anomaly-item" key={alert.transaction_id}>
                      <div className="risk-heading">
                        <strong>{alert.description || alert.category || "Expense"}</strong>
                        <span className="risk-badge exceeded">Unusual</span>
                      </div>
                      <div className="risk-values">
                        <span>{alert.category || "Uncategorized"}</span>
                        <span>{formatDate(alert.date)}</span>
                      </div>
                      <strong>{formatUGX(alert.amount)}</strong>
                      <small className="muted-text">
                        {Number.isFinite(Number(alert.times_higher)) &&
                        Number.isFinite(Number(alert.usual_amount))
                          ? `${alert.times_higher}× the usual ${alert.category || "category"} amount (${formatUGX(alert.usual_amount)}).`
                          : "Flagged by the backend’s unusual-spending analysis."}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel target-panel">
              <div className="section-heading">
                <h2>Suggested savings target</h2>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading savings recommendation...</p>
              ) : predictionError ? (
                <p className="data-unavailable">Savings target recommendation is unavailable.</p>
              ) : savingsTarget ? (
                <>
                  <div className="forecast-highlight">
                    <span>Suggested monthly savings</span>
                    <strong>
                      {Number(savingsTarget.recommended_monthly_saving) > 0
                        ? formatUGX(savingsTarget.recommended_monthly_saving)
                        : "Not available yet"}
                    </strong>
                  </div>
                  <p className="data-note">{savingsTarget.message}</p>
                </>
              ) : (
                <p className="empty-state">No savings target recommendation is available.</p>
              )}
              <p className="data-note">
                This recommendation is based on recent income and spending. Your tracked goal
                progress is shown below.
              </p>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel chart-panel">
              <div className="section-heading row-heading">
                <h2>Spending Trend</h2>
                <span className="muted-text">Last 6 months</span>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading spending trend...</p>
              ) : hasTrend ? (
                <>
                  <div className="line-chart">
                    {trend.map((point) => (
                      <span
                        key={point.month}
                        title={`${monthLabel(point.month)}: ${formatUGX(point.expenses)}`}
                        style={{ height: `${Math.max((point.expenses / maxExpense) * 100, 4)}%` }}
                      />
                    ))}
                  </div>
                  <div className="chart-labels">
                    {trend.map((point) => (
                      <span key={point.month}>{monthLabel(point.month)}</span>
                    ))}
                  </div>
                </>
              ) : dataErrors.trend ? (
                <p className="data-unavailable">{dataErrors.trend} Use Refresh to try again.</p>
              ) : (
                <p className="empty-state">Add expenses to see your spending trend.</p>
              )}
            </article>

            <article className="panel donut-panel">
              <div className="section-heading">
                <h2>Expenses by Category</h2>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading category spending...</p>
              ) : slices.length > 0 ? (
                <div className="donut-wrap">
                  <div className="donut" style={{ background: `conic-gradient(${gradientStops})` }}>
                    <span>{formatUGX(current?.expenses)}</span>
                  </div>
                  <div className="legend-list">
                    {slices.map((slice, index) => (
                      <span key={slice.category} className="legend-item">
                        <i
                          className="legend-dot"
                          style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                        />
                        {slice.category} · {slice.percent}%
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-state">No expenses this month yet.</p>
              )}
            </article>

            <article className="panel bills-panel">
              <div className="section-heading">
                <h2>Upcoming Bills</h2>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading upcoming bills...</p>
              ) : dataErrors.bills ? (
                <p className="data-unavailable">{dataErrors.bills} Use Refresh to try again.</p>
              ) : bills.length === 0 ? (
                <p className="empty-state">No bills due in the next 30 days.</p>
              ) : (
                <div className="mini-list">
                  {bills.slice(0, 5).map((bill) => (
                    <div className="mini-row" key={bill.id}>
                      <div>
                        <strong>{bill.name}</strong>
                        <span className={bill.is_overdue ? "danger-text" : "muted-text"}>
                          {dueText(bill)}
                        </span>
                      </div>
                      <b>{formatUGX(bill.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel goals-panel">
              <div className="section-heading row-heading">
                <h2>Savings Goals</h2>
                <Link to="/goals">Manage goals</Link>
              </div>
              {isLoading ? (
                <p className="empty-state">Loading savings goals...</p>
              ) : dataErrors.goals ? (
                <p className="data-unavailable">{dataErrors.goals} Use Refresh to try again.</p>
              ) : activeGoals.length === 0 ? (
                <p className="empty-state">No active goals yet.</p>
              ) : (
                <div className="mini-list">
                  {activeGoals.map((goal) => {
                    const percentSaved = Number(goal.percent_saved);
                    const progress = Number.isFinite(percentSaved)
                      ? Math.max(0, Math.min(100, percentSaved))
                      : 0;
                    return (
                      <div className="goal-item" key={goal.id}>
                        <div className="mini-row">
                          <strong>{goal.name}</strong>
                          <b>{progress}%</b>
                        </div>
                        <div className="meter">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <small className="muted-text">
                          {formatUGX(goal.saved_amount)} of {formatUGX(goal.target_amount)}
                          {Number.isFinite(Number(goal.amount_remaining))
                            ? ` · ${formatUGX(goal.amount_remaining)} remaining`
                            : ""}
                          {goal.monthly_needed
                            ? ` · save ${formatUGX(goal.monthly_needed)}/month`
                            : ""}
                        </small>
                      </div>
                    );
                  })}
                </div>
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
                {isLoading ? (
                  <p className="empty-state">Loading recent transactions...</p>
                ) : dataErrors.summary ? (
                  <p className="data-unavailable">
                    {dataErrors.summary} Use Refresh to try again.
                  </p>
                ) : recentTransactions.length === 0 ? (
                  <p className="empty-state">No transactions yet.</p>
                ) : null}
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