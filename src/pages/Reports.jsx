import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatDate, formatUGX, todayISODate } from "../utils";

const PREVIOUS_LABEL = {
  daily: "yesterday",
  weekly: "last week",
  monthly: "last month",
  yearly: "last year",
};

function buildEndpoint(period, dateStr) {
  const selected = new Date(`${dateStr}T00:00:00`);
  if (period === "monthly") {
    return `/reports/monthly?month=${selected.getMonth() + 1}&year=${selected.getFullYear()}`;
  }
  if (period === "yearly") return `/reports/yearly?year=${selected.getFullYear()}`;
  return `/reports/${period}?report_date=${dateStr}`;
}

function previousDate(period, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (period === "daily") d.setDate(d.getDate() - 1);
  else if (period === "weekly") d.setDate(d.getDate() - 7);
  else if (period === "monthly") d.setMonth(d.getMonth() - 1, 1);
  else d.setFullYear(d.getFullYear() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function percentChange(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function changeText(change, period) {
  const label = PREVIOUS_LABEL[period];
  if (change === null) return `No data for ${label}`;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs ${label}`;
}

function Reports() {
  const [period, setPeriod] = useState("monthly");
  const [reportDate, setReportDate] = useState(todayISODate());
  const [report, setReport] = useState(null);
  const [previousReport, setPreviousReport] = useState(null);
  const [message, setMessage] = useState("");

  async function loadReport() {
    setMessage("");
    try {
      setReport(await apiRequest(buildEndpoint(period, reportDate)));
    } catch (err) {
      setMessage(err.message);
      return;
    }
    try {
      setPreviousReport(
        await apiRequest(buildEndpoint(period, previousDate(period, reportDate))),
      );
    } catch {
      setPreviousReport(null);
    }
  }

  useEffect(() => {
    loadReport();
  }, [period, reportDate]);

  const categories = Object.entries(report?.category_breakdown || {});
  const hasReportData = (report?.transactions || []).length > 0;

  const incomeChange = percentChange(report?.total_income, previousReport?.total_income);
  const expenseChange = percentChange(report?.total_expenses, previousReport?.total_expenses);
  const balanceChange = percentChange(report?.balance, previousReport?.balance);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page">
          <header className="page-header">
            <div>
              <h1>Reports</h1>
              <p>Get a clear picture of your financial health.</p>
            </div>
            <input
              className="date-input"
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
            />
          </header>

          <section className="report-tabs">
            <button type="button" className="active" onClick={loadReport}>Overview</button>
            <button type="button">Spending Breakdown</button>
            <button type="button">Budget Performance</button>
            <select aria-label="Period" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </section>

          {message && <p className="form-message error">{message}</p>}

          <section className="summary-grid three">
            <article className="summary-card">
              <span className="card-icon violet">I</span>
              <h3>Total Income</h3>
              <p>{formatUGX(report?.total_income)}</p>
              <small>{changeText(incomeChange, period)}</small>
            </article>
            <article className="summary-card">
              <span className="card-icon coral">E</span>
              <h3>Total Expenses</h3>
              <p>{formatUGX(report?.total_expenses)}</p>
              <small className={expenseChange > 0 ? "danger-text" : undefined}>
                {changeText(expenseChange, period)}
              </small>
            </article>
            <article className="summary-card">
              <span className="card-icon teal">B</span>
              <h3>Balance</h3>
              <p>{formatUGX(report?.balance)}</p>
              <small>{changeText(balanceChange, period)}</small>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel chart-panel">
              <div className="section-heading">
                <h2>Income vs Expenses</h2>
                <p>{formatDate(report?.start_date)} to {formatDate(report?.end_date)}</p>
              </div>
              {hasReportData ? (
                <>
                  <div className="bar-chart" aria-hidden="true">
                    {[72, 52, 70, 49, 84, 56, 82, 62].map((height, index) => (
                      <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <div className="chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div>
                </>
              ) : (
                <p className="empty-state chart-empty">No report data for this period yet.</p>
              )}
            </article>

            <article className="panel donut-panel">
              <div className="section-heading">
                <h2>Spending By Category</h2>
              </div>
              {categories.length ? (
                <div className="donut-wrap">
                  <div className="donut"><span>{formatUGX(report?.total_expenses)}</span></div>
                  <div className="legend-list">
                    {categories.map(([category, amount]) => (
                      <span key={category}>{category} {formatUGX(amount)}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-state chart-empty">No category spending found.</p>
              )}
            </article>
          </section>

          <div className="right-action">
            <button type="button">Download Report</button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Reports;