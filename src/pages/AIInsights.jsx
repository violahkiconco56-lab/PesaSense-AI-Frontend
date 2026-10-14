import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { TRANSACTIONS_CHANGED, formatDate, formatUGX } from "../utils";

const CHART_COLORS = ["#146b4b", "#77a95c", "#d7a443", "#518b91", "#8a7e9b", "#c47561"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function money(value) {
  return typeof value === "number" && Number.isFinite(value) ? formatUGX(value) : "—";
}

function percentage(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "—";
}

function monthName(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}$/.test(key)) return "Month";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-UG", {
    month: "short",
    year: "2-digit",
  });
}

function changeLabel(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No previous-month baseline";
  }
  if (value === 0) return "No change vs last month";
  return `${value > 0 ? "↑" : "↓"} ${Math.abs(value)}% vs last month`;
}

function AIInsights() {
  const [insights, setInsights] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loadError, setLoadError] = useState("");
  const [chatError, setChatError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [trendWindow, setTrendWindow] = useState(6);
  const [showIncome, setShowIncome] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const isMounted = useRef(true);
  const requestInProgress = useRef(false);
  const chatEndRef = useRef(null);

  const fetchInsights = useCallback(async () => {
    if (requestInProgress.current) return null;
    requestInProgress.current = true;
    try {
      const data = await apiRequest("/transactions/insights/summary");
      if (
        !isRecord(data) ||
        !isRecord(data.monthly_summary) ||
        !Array.isArray(data.monthly_trend) ||
        !Array.isArray(data.recommendations)
      ) {
        throw new Error("The server returned an unexpected insights response.");
      }
      return data;
    } finally {
      requestInProgress.current = false;
    }
  }, []);

  const loadInsights = useCallback(async () => {
    if (requestInProgress.current) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const data = await fetchInsights();
      if (data && isMounted.current) setInsights(data);
    } catch (error) {
      if (isMounted.current) setLoadError(error.message || "Could not load financial insights.");
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [fetchInsights]);

  const refreshInsights = useCallback(() => {
    setIsLoading(true);
    setLoadError("");
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadInitialInsights() {
      try {
        const data = await fetchInsights();
        if (data && isMounted.current) {
          setInsights(data);
          setLoadError("");
        }
      } catch (error) {
        if (isMounted.current) {
          setLoadError(error.message || "Could not load financial insights.");
        }
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    }

    void loadInitialInsights();
  }, [fetchInsights]);

  useEffect(() => {
    window.addEventListener("focus", refreshInsights);
    window.addEventListener(TRANSACTIONS_CHANGED, loadInsights);
    return () => {
      window.removeEventListener("focus", refreshInsights);
      window.removeEventListener(TRANSACTIONS_CHANGED, loadInsights);
    };
  }, [loadInsights, refreshInsights]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chatEndRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [messages, isAsking]);

  const monthly = insights?.monthly_summary;
  const categoryBreakdown = insights?.month_category_breakdown;
  const trend = useMemo(
    () => (insights?.monthly_trend || []).slice(-trendWindow),
    [insights?.monthly_trend, trendWindow],
  );
  const categories = useMemo(() => {
    const rows = Array.isArray(categoryBreakdown) ? categoryBreakdown : [];
    return rows
      .filter(
        (row) =>
          isRecord(row) &&
          typeof row.category === "string" &&
          typeof row.total === "number" &&
          Number.isFinite(row.total) &&
          row.total >= 0,
      )
      .slice(0, 8);
  }, [categoryBreakdown]);
  const categoryTotal = categories.reduce((total, row) => total + row.total, 0);
  const categoryGradient = categories
    .reduce(
      (gradient, row, index) => {
        const start = gradient.percent;
        const end = start + (categoryTotal ? (row.total / categoryTotal) * 100 : 0);
        return {
          percent: end,
          stops: [
            ...gradient.stops,
            `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${end}%`,
          ],
        };
      },
      { percent: 0, stops: [] },
    )
    .stops.join(", ");
  const selectedCategoryData =
    categories.find((row) => row.category === selectedCategory) || null;
  const forecast = insights?.forecast;
  const budgetRisks = (insights?.budget_risks || []).filter(
    (risk) => risk.status === "at_risk" || risk.status === "exceeded",
  );
  const anomalies = insights?.unusual_spending || [];
  const goals = insights?.savings_goals || [];
  const upcomingBills = insights?.upcoming_bills || [];
  const recommendations = insights?.recommendations || [];

  async function askQuestion(event) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (submittedQuestion.length < 5 || submittedQuestion.length > 500) {
      setChatError("Ask a question between 5 and 500 characters.");
      return;
    }

    setChatError("");
    setIsAsking(true);
    try {
      const data = await apiRequest("/transactions/insights/question", {
        method: "POST",
        body: JSON.stringify({
          question: submittedQuestion,
          history: messages.slice(-8).map(({ role, content }) => ({ role, content })),
        }),
      });
      if (typeof data?.answer !== "string" || !data.answer.trim()) {
        throw new Error("The AI assistant did not return an answer. Please try again.");
      }
      setMessages((current) =>
        [...current, { role: "user", content: submittedQuestion }, { role: "assistant", content: data.answer }]
          .slice(-20),
      );
      setQuestion("");
    } catch (error) {
      setChatError(error.message || "The AI assistant is unavailable. Please try again.");
    } finally {
      setIsAsking(false);
    }
  }

  const hasActivity = (monthly?.transaction_count || 0) > 0;
  const monthLabel = insights?.period?.label || "Current month";

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page ai-insights-page">
          <header className="page-header ai-page-header">
            <div>
              <span className="ai-kicker">YOUR FINANCIAL PICTURE</span>
              <h1>Financial intelligence, grounded in your records.</h1>
              <p>
                Clear month-to-date analysis, practical next steps, and an assistant
                that distinguishes recorded facts from estimates.
              </p>
            </div>
            <button type="button" className="secondary-button" onClick={refreshInsights} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh insights"}
            </button>
          </header>

          {loadError && (
            <div className="form-message error ai-error-banner" role="alert">
              <span>{loadError}</span>
              <button type="button" onClick={refreshInsights} disabled={isLoading}>
                Retry
              </button>
            </div>
          )}

          {isLoading && !insights ? (
            <section className="ai-skeleton-grid" aria-label="Loading financial insights">
              <div className="panel ai-skeleton-card"><span /><span /><span /></div>
              <div className="panel ai-skeleton-card"><span /><span /><span /></div>
              <div className="panel ai-skeleton-card"><span /><span /><span /></div>
              <div className="panel ai-skeleton-card"><span /><span /><span /></div>
            </section>
          ) : loadError && !insights ? (
            <section className="panel ai-empty-panel">
              <h2>Insights could not be loaded</h2>
              <p>Check your connection and try again. Your financial records have not been changed.</p>
              <button type="button" onClick={refreshInsights}>Try again</button>
            </section>
          ) : (
            <>
              <section className="ai-section-heading">
                <div>
                  <span className="ai-kicker">AT A GLANCE</span>
                  <h2>{monthLabel}</h2>
                </div>
                <p>Recorded transactions · UGX</p>
              </section>

              {hasActivity ? (
                <section className="ai-metric-grid">
                  <article className="panel ai-metric-card">
                    <span className="ai-metric-label">Income recorded</span>
                    <strong>{money(monthly?.income)}</strong>
                    <small>{monthly?.transaction_count} transaction(s) this month</small>
                  </article>
                  <article className="panel ai-metric-card">
                    <span className="ai-metric-label">Expenses recorded</span>
                    <strong>{money(monthly?.expenses)}</strong>
                    <small>{changeLabel(insights?.expense_change_percent)}</small>
                  </article>
                  <article className="panel ai-metric-card">
                    <span className="ai-metric-label">Net cash flow so far</span>
                    <strong className={monthly?.net_savings < 0 ? "danger-text" : ""}>
                      {money(monthly?.net_savings)}
                    </strong>
                    <small>Recorded income minus recorded expenses</small>
                  </article>
                  <article className="panel ai-metric-card">
                    <span className="ai-metric-label">Savings rate</span>
                    <strong>
                      {typeof monthly?.savings_rate === "number"
                        ? `${monthly.savings_rate}%`
                        : "—"}
                    </strong>
                    <small>
                      {monthly?.savings_rate == null
                        ? "No income baseline for this period"
                        : "Calculated from recorded income and expenses"}
                    </small>
                  </article>
                </section>
              ) : (
                <section className="panel ai-empty-panel">
                  <h2>Start with your financial records</h2>
                  <p>
                    There is no income or spending recorded for {monthLabel} yet. Add
                    transactions to unlock period comparisons and meaningful insights.
                  </p>
                  <Link className="primary-action" to="/transactions">Add a transaction</Link>
                </section>
              )}

              <section className="ai-primary-grid">
                <article className="panel ai-chart-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">CASH FLOW PATTERN</span>
                      <h2>Income and expenses</h2>
                      <p>Monthly totals from recorded transactions.</p>
                    </div>
                    <label className="ai-chart-select">
                      <span>Period</span>
                      <select
                        aria-label="Trend chart period"
                        value={trendWindow}
                        onChange={(event) => setTrendWindow(Number(event.target.value))}
                      >
                        <option value={3}>3 months</option>
                        <option value={6}>6 months</option>
                      </select>
                    </label>
                  </div>
                  {trend.length > 0 ? (
                    <TrendChart
                      data={trend}
                      showIncome={showIncome}
                      showExpenses={showExpenses}
                    />
                  ) : (
                    <p className="empty-state chart-empty">No monthly trend data is available.</p>
                  )}
                  <div className="ai-chart-legend">
                    <button
                      className={showIncome ? "selected" : ""}
                      type="button"
                      aria-pressed={showIncome}
                      onClick={() => setShowIncome((shown) => !shown)}
                    >
                      <i className="ai-legend-dot income-dot" /> Income
                    </button>
                    <button
                      className={showExpenses ? "selected" : ""}
                      type="button"
                      aria-pressed={showExpenses}
                      onClick={() => setShowExpenses((shown) => !shown)}
                    >
                      <i className="ai-legend-dot expense-dot" /> Expenses
                    </button>
                  </div>
                </article>

                <article className="panel ai-chart-panel ai-category-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">SPENDING MIX</span>
                      <h2>Where expenses go</h2>
                      <p>Category totals for {monthLabel.toLowerCase()}.</p>
                    </div>
                  </div>
                  {categories.length ? (
                    <>
                      <div className="ai-donut-layout">
                        <div
                          className="ai-donut"
                          role="img"
                          aria-label={`Category spending totals ${formatUGX(categoryTotal)}`}
                          style={{ background: `conic-gradient(${categoryGradient})` }}
                        >
                          <div>
                            <small>{selectedCategoryData ? "Selected" : "Total expenses"}</small>
                            <strong>
                              {selectedCategoryData
                                ? formatUGX(selectedCategoryData.total)
                                : formatUGX(categoryTotal)}
                            </strong>
                          </div>
                        </div>
                        <div className="ai-category-legend">
                          {categories.map((category, index) => (
                            <button
                              key={category.category}
                              type="button"
                              className={selectedCategory === category.category ? "active" : ""}
                              aria-pressed={selectedCategory === category.category}
                              title={`${category.category}: ${formatUGX(category.total)}`}
                              onClick={() =>
                                setSelectedCategory((current) =>
                                  current === category.category ? null : category.category,
                                )
                              }
                            >
                              <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                              <span>{category.category}</span>
                              <strong>{percentage(category.percent)}</strong>
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="ai-chart-caption">
                        {selectedCategoryData
                          ? `${selectedCategoryData.category} accounts for ${selectedCategoryData.percent}% of recorded expenses.`
                          : "Select a category to inspect its recorded amount and share."}
                      </p>
                    </>
                  ) : (
                    <p className="empty-state chart-empty">No category spending has been recorded this month.</p>
                  )}
                </article>
              </section>

              <section className="ai-primary-grid">
                <article className="panel ai-forecast-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">ESTIMATE · NOT A GUARANTEE</span>
                      <h2>Month-end outlook</h2>
                      <p>
                        {insights?.period?.days_elapsed} of {insights?.period?.days_in_month} days elapsed
                        in {monthLabel}.
                      </p>
                    </div>
                    {forecast?.confidence && (
                      <span className={`confidence-pill ${forecast.confidence}`}>
                        {forecast.confidence === "insufficient_data"
                          ? "Insufficient data"
                          : `${forecast.confidence} confidence`}
                      </span>
                    )}
                  </div>
                  {forecast?.is_available ? (
                    <div className="ai-forecast-values">
                      <div>
                        <span>Projected month-end expenses</span>
                        <strong>{money(forecast.projected_total)}</strong>
                      </div>
                      {typeof forecast.projected_savings === "number" && (
                        <div>
                          <span>Estimated net cash flow*</span>
                          <strong className={forecast.projected_savings < 0 ? "danger-text" : ""}>
                            {money(forecast.projected_savings)}
                          </strong>
                        </div>
                      )}
                      <p>
                        {forecast.method === "recent_monthly_average"
                          ? `Estimate uses the average of ${forecast.historical_months_used} recent month(s) with recorded expenses.`
                          : `Estimate extends the current ${money(forecast.daily_average)} daily spending pace across the month.`}
                        {" "}Historical patterns may change. *Recorded income this month minus projected expenses; not an account balance.
                      </p>
                    </div>
                  ) : (
                    <p className="ai-insufficient">
                      There is not enough recent spending history to estimate month-end expenses reliably.
                    </p>
                  )}
                </article>

                <article className="panel ai-risk-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">BUDGET CHECK</span>
                      <h2>Needs attention</h2>
                      <p>Current-month statuses from backend budget logic.</p>
                    </div>
                    <Link to="/budgets">Manage budgets</Link>
                  </div>
                  {budgetRisks.length ? (
                    <div className="ai-risk-list">
                      {budgetRisks.map((risk) => {
                        const usedPercent =
                          typeof risk.percent_used === "number" &&
                          Number.isFinite(risk.percent_used)
                            ? risk.percent_used
                            : null;
                        const width = usedPercent !== null
                          ? Math.max(0, Math.min(100, usedPercent))
                          : 0;
                        const exceeded = risk.status === "exceeded";
                        const overAmount =
                          Number.isFinite(risk.spent) && Number.isFinite(risk.limit)
                            ? risk.spent - risk.limit
                            : null;
                        return (
                          <div className="ai-risk-item" key={`${risk.category}-${risk.status}`}>
                            <div className="ai-risk-title">
                              <strong>{risk.category}</strong>
                              <span className={exceeded ? "risk-badge exceeded" : "risk-badge"}>
                                {exceeded ? "Over limit" : "At risk"}
                              </span>
                            </div>
                            <div className="meter">
                              <span className={exceeded ? "danger" : "warn"} style={{ width: `${width}%` }} />
                            </div>
                            <p>
                              {money(risk.spent)} of {money(risk.limit)} used · {percentage(usedPercent)}.
                              {exceeded
                                ? ` ${money(overAmount)} over the limit.`
                                : ` Projected ${money(risk.projected)} by month-end.`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="ai-insufficient">
                      No budgets are currently flagged as at risk or exceeded.
                    </p>
                  )}
                </article>
              </section>

              <section className="ai-primary-grid">
                <article className="panel ai-anomaly-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">EVIDENCE-BASED FLAGS</span>
                      <h2>Unusual spending</h2>
                      <p>Only transactions flagged by the backend’s historical comparison are shown.</p>
                    </div>
                  </div>
                  {anomalies.length ? (
                    <div className="ai-risk-list">
                      {anomalies.map((anomaly) => (
                        <div className="ai-anomaly-row" key={anomaly.transaction_id}>
                          <span className="anomaly-marker" aria-hidden="true">!</span>
                          <div>
                            <div className="ai-risk-title">
                              <strong>{anomaly.category || "Expense"}</strong>
                              <strong>{money(anomaly.amount)}</strong>
                            </div>
                            {anomaly.description && (
                              <p className="ai-anomaly-description">{anomaly.description}</p>
                            )}
                            <p>{anomaly.explanation || "Flagged against the recorded category baseline."}</p>
                            <small>{formatDate(anomaly.date)} · usual {money(anomaly.usual_amount)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ai-insufficient">
                      No transaction met the backend’s unusual-spending threshold. Categories with too little prior history are not assessed.
                    </p>
                  )}
                </article>

                <article className="panel ai-actions-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">PERSONALIZED NEXT STEPS</span>
                      <h2>Recommendations</h2>
                      <p>Calculated from your budgets, spending patterns, goals, and bills.</p>
                    </div>
                  </div>
                  {recommendations.length ? (
                    <ol className="ai-recommendation-list">
                      {recommendations.map((recommendation, index) => (
                        <li key={`${recommendation.title}-${index}`}>
                          <span className={`urgency-mark ${recommendation.urgency}`}>
                            {index + 1}
                          </span>
                          <div>
                            <strong>{recommendation.title}</strong>
                            <p>{recommendation.detail}</p>
                            {recommendation.evidence && (
                              <small>Evidence: {recommendation.evidence}</small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="ai-insufficient">
                      There is not enough financial activity yet to make a specific recommendation.
                    </p>
                  )}
                </article>
              </section>

              <section className="ai-secondary-grid">
                <article className="panel ai-summary-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">GENERATED FROM VERIFIED AGGREGATES</span>
                      <h2>Your AI briefing</h2>
                    </div>
                    <span className={`ai-status ${insights?.ai_available ? "available" : "unavailable"}`}>
                      {insights?.ai_available ? "AI connected" : "AI unavailable"}
                    </span>
                  </div>
                  {insights?.summary ? (
                    <p className="ai-summary-text">{insights.summary}</p>
                  ) : (
                    <div className="ai-unavailable">
                      <p>
                        {insights?.ai_summary_error ||
                          "A generated briefing is not available right now. No canned answer is shown."}
                      </p>
                      <button type="button" className="secondary-button" onClick={loadInsights} disabled={isLoading}>
                        Retry AI briefing
                      </button>
                    </div>
                  )}
                  <p className="ai-privacy-note">
                    The briefing is generated from aggregate financial figures; transaction descriptions and account identifiers are not sent as context.
                  </p>
                </article>

                <article className="panel ai-context-panel">
                  <div className="ai-panel-heading">
                    <div>
                      <span className="ai-kicker">OTHER COMMITMENTS</span>
                      <h2>Goals and upcoming bills</h2>
                    </div>
                  </div>
                  <div className="ai-context-columns">
                    <div>
                      <h3><Link to="/goals">Savings goals</Link></h3>
                      {goals.length ? goals.slice(0, 3).map((goal) => (
                        <div className="ai-context-row" key={goal.id}>
                          <span>{goal.name}</span>
                          <strong>{percentage(goal.percent_saved)} · {money(goal.amount_remaining)} left</strong>
                        </div>
                      )) : <p className="ai-insufficient">No savings goals recorded.</p>}
                    </div>
                    <div>
                      <h3>Next 30 days</h3>
                      {upcomingBills.length ? upcomingBills.slice(0, 3).map((bill, index) => (
                        <div className="ai-context-row" key={`${bill.name}-${bill.next_due_date}-${index}`}>
                          <span>{bill.name} · {formatDate(bill.next_due_date)}</span>
                          <strong>{money(bill.amount)}</strong>
                        </div>
                      )) : <p className="ai-insufficient">No active bills due in this period.</p>}
                    </div>
                  </div>
                </article>
              </section>

              <section className="panel ai-chat-panel">
                <div className="ai-chat-header">
                  <div className="ai-avatar" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  </div>
                  <div>
                    <span className="ai-kicker">PESASENSE ASSISTANT</span>
                    <h2>Ask about your finances</h2>
                    <p>Answers are grounded in this account’s current verified aggregates.</p>
                  </div>
                </div>

                <div className="ai-chat-messages" aria-live="polite">
                  {messages.length === 0 && (
                    <div className="ai-chat-welcome">
                      <strong>What would you like to understand?</strong>
                      <p>Ask about spending changes, budgets, cash flow, or savings goals.</p>
                      <div className="ai-prompt-chips">
                        {[
                          "Where does most of my money go?",
                          "Which budgets need attention?",
                          "How much could I realistically save?",
                        ].map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => setQuestion(prompt)}
                            disabled={isAsking}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <div
                      className={`ai-chat-message ${message.role}`}
                      key={`${message.role}-${index}`}
                    >
                      <span>{message.role === "assistant" ? "PesaSense AI" : "You"}</span>
                      <p>{message.content}</p>
                    </div>
                  ))}
                  {isAsking && (
                    <div className="ai-chat-message assistant" role="status">
                      <span>PesaSense AI</span>
                      <p className="ai-typing">Analyzing your verified financial snapshot…</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {chatError && <p className="form-message error" role="alert">{chatError}</p>}
                <form className="ai-chat-form" onSubmit={askQuestion}>
                  <label htmlFor="finance-question">Your question</label>
                  <div>
                    <textarea
                      id="finance-question"
                      rows="2"
                      maxLength={500}
                      value={question}
                      onChange={(event) => {
                        setQuestion(event.target.value);
                        setChatError("");
                      }}
                      placeholder="e.g. Why did my spending increase this month?"
                      required
                    />
                    <button type="submit" disabled={isAsking || question.trim().length < 5}>
                      {isAsking ? "Thinking..." : "Ask PesaSense"}
                    </button>
                  </div>
                  <small>{question.length}/500 · Do not include passwords or account credentials.</small>
                </form>
              </section>

              {!hasActivity && (
                <p className="ai-data-note">
                  Your charts and forecasts will fill in as you record income and expenses.
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TrendChart({ data, showIncome, showExpenses }) {
  const width = 640;
  const height = 250;
  const left = 54;
  const right = 20;
  const top = 20;
  const bottom = 42;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const values = data.flatMap((point) => [
    showIncome ? point.income || 0 : 0,
    showExpenses ? point.expenses || 0 : 0,
  ]);
  const maxValue = Math.max(...values, 0);
  const scaleMax = maxValue || 1;
  const xFor = (index) =>
    data.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (data.length - 1);
  const yFor = (value) => top + plotHeight - ((value || 0) / scaleMax) * plotHeight;
  const incomePoints = data.map((point, index) => `${xFor(index)},${yFor(point.income || 0)}`).join(" ");
  const expensePoints = data.map((point, index) => `${xFor(index)},${yFor(point.expenses || 0)}`).join(" ");
  const gridLines = [0, 1, 2, 3].map((line) => top + (plotHeight * line) / 3);

  return (
    <div className="ai-trend-chart">
      {maxValue > 0 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Monthly income and expense trend in Ugandan shillings"
        >
          {gridLines.map((y, index) => (
            <g key={y}>
              <line x1={left} y1={y} x2={width - right} y2={y} className="chart-grid-line" />
              <text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                {formatUGX((scaleMax * (3 - index)) / 3).replace("UGX ", "")}
              </text>
            </g>
          ))}
          {showIncome && (
            <polyline className="income-line" points={incomePoints} />
          )}
          {showExpenses && (
            <polyline className="expenses-line" points={expensePoints} />
          )}
          {data.map((point, index) => (
            <g key={point.month}>
              {showIncome && (
                <circle
                  className="income-point"
                  cx={xFor(index)}
                  cy={yFor(point.income || 0)}
                  r="4"
                  tabIndex="0"
                >
                  <title>{`${monthName(point.month)} income: ${formatUGX(point.income || 0)}`}</title>
                </circle>
              )}
              {showExpenses && (
                <circle
                  className="expenses-point"
                  cx={xFor(index)}
                  cy={yFor(point.expenses || 0)}
                  r="4"
                  tabIndex="0"
                >
                  <title>{`${monthName(point.month)} expenses: ${formatUGX(point.expenses || 0)}`}</title>
                </circle>
              )}
              <text
                x={xFor(index)}
                y={height - 13}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {monthName(point.month)}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <p className="empty-state chart-empty">No income or expense totals are available for this period.</p>
      )}
    </div>
  );
}

export default AIInsights;
