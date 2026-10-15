import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatDate, formatUGX, todayISODate } from "../utils";
import { FREQUENCY_LABELS, emptyIncomeSummary, friendlyError } from "../income";

// Income can only be created from the Budget page's income card, so the form
// here is expenditure-only.
const blankForm = {
  transaction_type: "expense",
  amount: "",
  category: "",
  description: "",
  date: todayISODate(),
};

const CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Rent",
  "Airtime & Data",
  "Health",
  "Education",
  "Entertainment",
  "Shopping",
  "Savings",
  "Business",
  "Other",
];

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [incomeSummary, setIncomeSummary] = useState(emptyIncomeSummary);
  const [message, setMessage] = useState("");
  const [isMessageError, setIsMessageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.transaction_type === "income") acc.income += Number(transaction.amount);
        if (transaction.transaction_type === "expense") acc.expenses += Number(transaction.amount);
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [transactions]);

  // Income and expenditure live in separate tables so the two are never mixed.
  const incomeTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.transaction_type === "income"),
    [transactions]
  );
  const expenseTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.transaction_type !== "income"),
    [transactions]
  );

  const loadTransactions = useCallback(async () => {
    const data = await apiRequest("/transactions/?skip=0&limit=100");
    setTransactions(data);
  }, []);

  const loadIncomeSummary = useCallback(async () => {
    const data = await apiRequest("/transactions/income/summary");
    setIncomeSummary({ ...emptyIncomeSummary, ...(data || {}) });
  }, []);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadTransactions(), loadIncomeSummary()]);
    } catch (err) {
      setMessage(friendlyError(err));
      setIsMessageError(true);
    } finally {
      setIsLoading(false);
    }
  }, [loadTransactions, loadIncomeSummary]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Income is added on the Budget page, so re-read the list whenever this tab
  // regains focus to pick up new rows.
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsMessageError(false);
    try {
      await apiRequest("/transactions/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          date: form.date ? `${form.date}T00:00:00Z` : null,
        }),
      });
      setForm(blankForm);
      setMessage("Transaction added.");
      await refresh();
    } catch (err) {
      setIsMessageError(true);
      setMessage(friendlyError(err));
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
              <h1>Transactions</h1>
              <p>Manage and track your income and expenses.</p>
            </div>
          </header>

          <section className="summary-grid three">
            <article className="summary-card">
              <span className="card-icon green">I</span>
              <h3>Total Income</h3>
              <p>{formatUGX(totals.income)}</p>
              <small>
                {incomeSummary?.income_count ?? 0} income source
                {(incomeSummary?.income_count ?? 0) === 1 ? "" : "s"}
              </small>
            </article>
            <article className="summary-card">
              <span className="card-icon coral">E</span>
              <h3>Total Expense</h3>
              <p>{formatUGX(totals.expenses)}</p>
              <small className="danger-text">Recorded spending</small>
            </article>
            <article className="summary-card">
              <span className="card-icon teal">M</span>
              <h3>Est. Monthly Income</h3>
              <p>{formatUGX(incomeSummary?.monthly_income)}</p>
              <small>Recurring income included</small>
            </article>
          </section>

          <section className="content-grid wide-first">
            <article className="panel">
              <div className="filters compact-filters">
                <select aria-label="Category filter" defaultValue="all">
                  <option value="all">All Categories</option>
                </select>
                <input type="search" placeholder="Search expenses..." />
              </div>
              <div className="section-heading">
                <h2>Expenditure</h2>
                <p>Money you spent. Income is listed separately on the Budgets page.</p>
              </div>
              <div className="data-table">
                <div className="data-head">
                  <span>Date</span><span>Description</span><span>Category</span><span>Type</span><span>Amount</span>
                </div>
                {expenseTransactions.map((transaction) => (
                  <div className="data-row" key={transaction.id}>
                    <span>{formatDate(transaction.date)}</span>
                    <strong>{transaction.description || transaction.category}</strong>
                    <span>{transaction.category}</span>
                    <span className={transaction.transaction_type}>
                      {transaction.transaction_type}
                    </span>
                    <b>{formatUGX(transaction.amount)}</b>
                  </div>
                ))}
                {expenseTransactions.length === 0 && !isLoading && (
                  <p className="empty-state">No expenses found.</p>
                )}
                {isLoading && <p className="empty-state">Loading transactions...</p>}
              </div>
            </article>

            <article className="panel">
              <div className="section-heading row-heading">
                <div>
                  <h2>Income</h2>
                  <p>Recorded from the income card on the Budgets page.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="data-head">
                  <span>Date</span><span>Description</span><span>Category</span><span>Frequency</span><span>Amount</span>
                </div>
                {incomeTransactions.map((transaction) => (
                  <div className="data-row" key={transaction.id}>
                    <span>{formatDate(transaction.date)}</span>
                    <strong>{transaction.description || transaction.category}</strong>
                    <span>{transaction.category}</span>
                    <span>
                      {transaction.frequency
                        ? FREQUENCY_LABELS[transaction.frequency] || transaction.frequency
                        : "One-time"}
                    </span>
                    <b>{formatUGX(transaction.amount)}</b>
                  </div>
                ))}
                {incomeTransactions.length === 0 && !isLoading && (
                  <p className="empty-state">No income recorded yet.</p>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="section-heading">
                <h2>Add Expense</h2>
                <p>
                  Income is added from the income card on the Budgets page. Record your spending
                  here.
                </p>
              </div>
              <form className="stack-form" onSubmit={handleSubmit}>
                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />

                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  required
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <label htmlFor="description">Description</label>
                <input
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />

                <label htmlFor="date">Date</label>
                <input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />

                <button type="submit">Add expense</button>
              </form>
              {message && (
                <p className={`form-message${isMessageError ? " error" : " success"}`}>{message}</p>
              )}
            </article>
          </section>
        </main>
      </div>

    </div>
  );
}

export default Transactions;