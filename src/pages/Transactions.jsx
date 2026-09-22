import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatDate, formatUGX, todayISODate } from "../utils";

const blankForm = {
  transaction_type: "expense",
  amount: "",
  category: "",
  description: "",
  date: todayISODate(),
};

const INCOME_SOURCES = [
  "Salary",
  "Business",
  "Side Hustle",
  "Freelance",
  "Farming",
  "Rental",
  "Gift",
  "Other",
];

const INCOME_FREQUENCIES = [
  { value: "one_time", label: "One-time", hint: "A single payment" },
  { value: "daily", label: "Daily", hint: "Earned every day" },
  { value: "weekly", label: "Weekly", hint: "Earned every week" },
  { value: "monthly", label: "Monthly", hint: "Earned every month" },
];

const FREQUENCY_LABELS = {
  one_time: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const blankIncome = {
  amount: "",
  category: "Salary",
  customCategory: "",
  frequency: "monthly",
  description: "",
  date: todayISODate(),
};

// Turn raw backend/network failures into something a user can act on.
function friendlyError(error) {
  const status = error?.status;
  const detail = String(error?.message || "");

  if (status === 0) {
    return "Cannot reach the server. Make sure the backend is running, then try again.";
  }
  if (status === 404 || /not found/i.test(detail)) {
    return "Income service is unavailable. Restart the backend server so the latest code is loaded.";
  }
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (status === 422) {
    return "Some details are invalid. Check the amount, source and frequency, then try again.";
  }
  if (status >= 500) {
    return "The server ran into a problem adding this income. Please try again.";
  }
  return detail || "Could not add income. Please try again.";
}

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [income, setIncome] = useState(blankIncome);
  const [incomeSummary, setIncomeSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [incomeMessage, setIncomeMessage] = useState("");
  const [incomeErrors, setIncomeErrors] = useState({});
  const [isIncomeError, setIsIncomeError] = useState(false);
  const [isSavingIncome, setIsSavingIncome] = useState(false);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.transaction_type === "income") acc.income += transaction.amount;
        if (transaction.transaction_type === "expense") acc.expenses += transaction.amount;
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [transactions]);

  async function loadTransactions() {
    const data = await apiRequest("/transactions/?skip=0&limit=100");
    setTransactions(data);
  }

  async function loadIncomeSummary() {
    const data = await apiRequest("/transactions/income/summary");
    setIncomeSummary(data);
  }

  useEffect(() => {
    loadTransactions().catch((err) => setMessage(err.message));
    loadIncomeSummary().catch(() => setIncomeSummary(null));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
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
      await loadTransactions();
      await loadIncomeSummary();
    } catch (err) {
      setMessage(friendlyError(err));
    }
  }

  async function handleAddIncome(event) {
    event.preventDefault();
    setIncomeMessage("");
    setIsIncomeError(false);

    const source = (income.category === "Other" ? income.customCategory : income.category).trim();
    const nextErrors = {};
    const amountValue = Number(income.amount);

    if (!income.amount) {
      nextErrors.amount = "Amount is required.";
    } else if (!Number.isFinite(amountValue) || amountValue <= 0) {
      nextErrors.amount = "Enter an amount greater than zero.";
    }

    if (income.category === "Other" && source.length < 2) {
      nextErrors.category = "Please name the income source.";
    }

    if (!income.frequency) {
      nextErrors.frequency = "Choose how often you earn this.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setIncomeErrors(nextErrors);
      setIsIncomeError(true);
      setIncomeMessage("Please fix the highlighted fields.");
      return;
    }

    setIncomeErrors({});
    setIsSavingIncome(true);
    try {
      await apiRequest("/transactions/", {
        method: "POST",
        body: JSON.stringify({
          amount: amountValue,
          transaction_type: "income",
          category: source,
          description: income.description || null,
          frequency: income.frequency,
          date: income.date ? `${income.date}T00:00:00Z` : null,
        }),
      });
      setIncome(blankIncome);
      setIncomeErrors({});
      setIsIncomeError(false);
      setIncomeMessage("Income added. Your reports and AI guidance are updated.");
      await loadTransactions();
      await loadIncomeSummary();
    } catch (err) {
      // Never clear the form on failure: the user keeps what they typed so they
      // can retry. Only a successful save resets the fields.
      setIsIncomeError(true);
      setIncomeMessage(friendlyError(err));
    } finally {
      setIsSavingIncome(false);
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
            <a className="primary-action" href="#add-income">Add Income</a>
          </header>

          <section className="summary-grid three">
            <article className="summary-card">
              <span className="card-icon green">I</span>
              <h3>Total Income</h3>
              <p>{formatUGX(totals.income)}</p>
              <small>{incomeSummary?.income_count ?? 0} income source{(incomeSummary?.income_count ?? 0) === 1 ? "" : "s"}</small>
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

          <section className="panel income-panel" id="add-income">
            <div className="section-heading row-heading">
              <div>
                <h2>Add Income</h2>
                <p>Record how you earn it, and how often, so PesaSense can guide you accurately.</p>
              </div>
            </div>

            <form className="income-form" onSubmit={handleAddIncome} noValidate>
              <div className="field-group">
                <label htmlFor="income_amount">Amount (UGX)</label>
                <input
                  id="income_amount"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="e.g. 1200000"
                  value={income.amount}
                  onChange={(event) => {
                    setIncome({ ...income, amount: event.target.value });
                    setIncomeErrors((current) => ({ ...current, amount: "" }));
                  }}
                  className={incomeErrors.amount ? "input-error" : ""}
                  aria-invalid={Boolean(incomeErrors.amount)}
                  required
                />
                {incomeErrors.amount && <span className="field-error">{incomeErrors.amount}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="income_category">Income source</label>
                <select
                  id="income_category"
                  value={income.category}
                  onChange={(event) => {
                    setIncome({ ...income, category: event.target.value });
                    setIncomeErrors((current) => ({ ...current, category: "" }));
                  }}
                  className={incomeErrors.category ? "input-error" : ""}
                  aria-invalid={Boolean(incomeErrors.category)}
                >
                  {INCOME_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
                {incomeErrors.category && <span className="field-error">{incomeErrors.category}</span>}
              </div>

              {income.category === "Other" && (
                <div className="field-group">
                  <label htmlFor="income_custom">Name the source</label>
                  <input
                    id="income_custom"
                    placeholder="e.g. Poultry sales"
                    value={income.customCategory}
                    onChange={(event) => {
                      setIncome({ ...income, customCategory: event.target.value });
                      setIncomeErrors((current) => ({ ...current, category: "" }));
                    }}
                    className={incomeErrors.category ? "input-error" : ""}
                    aria-invalid={Boolean(incomeErrors.category)}
                    required
                  />
                  {incomeErrors.category && <span className="field-error">{incomeErrors.category}</span>}
                </div>
              )}

              <div className="field-group">
                <label htmlFor="income_date">Date received</label>
                <input
                  id="income_date"
                  type="date"
                  value={income.date}
                  onChange={(event) => setIncome({ ...income, date: event.target.value })}
                />
              </div>

              <fieldset className="frequency-picker">
                <legend>How often do you earn this?</legend>
                <div className="frequency-options">
                  {INCOME_FREQUENCIES.map((option) => (
                    <label
                      key={option.value}
                      className={`frequency-option${income.frequency === option.value ? " selected" : ""}${incomeErrors.frequency ? " input-error" : ""}`}
                    >
                      <input
                        type="radio"
                        name="income_frequency"
                        value={option.value}
                        checked={income.frequency === option.value}
                        onChange={(event) => {
                          setIncome({ ...income, frequency: event.target.value });
                          setIncomeErrors((current) => ({ ...current, frequency: "" }));
                        }}
                      />
                      <strong>{option.label}</strong>
                      <span>{option.hint}</span>
                    </label>
                  ))}
                </div>
                {incomeErrors.frequency && <span className="field-error">{incomeErrors.frequency}</span>}
              </fieldset>

              <div className="field-group income-note-field">
                <label htmlFor="income_description">Note (optional)</label>
                <input
                  id="income_description"
                  placeholder="e.g. September salary"
                  value={income.description}
                  onChange={(event) => setIncome({ ...income, description: event.target.value })}
                />
              </div>

              <div className="income-actions">
                <button type="submit" disabled={isSavingIncome}>
                  {isSavingIncome ? "Saving..." : "Add income"}
                </button>
                {incomeSummary?.monthly_income > 0 && (
                  <p className="income-estimate">
                    Estimated monthly income: <strong>{formatUGX(incomeSummary.monthly_income)}</strong>
                  </p>
                )}
              </div>
            </form>

            {incomeMessage && (
              <p className={`form-message${isIncomeError ? " error" : " success"}`}>{incomeMessage}</p>
            )}
          </section>

          <section className="content-grid wide-first">
            <article className="panel">
              <div className="filters compact-filters">
                <select aria-label="Type filter" defaultValue="all">
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <select aria-label="Category filter" defaultValue="all">
                  <option value="all">All Categories</option>
                </select>
                <input type="search" placeholder="Search transactions..." />
              </div>
              <div className="data-table">
                <div className="data-head">
                  <span>Date</span><span>Description</span><span>Category</span><span>Type</span><span>Amount</span>
                </div>
                {transactions.map((transaction) => (
                  <div className="data-row" key={transaction.id}>
                    <span>{formatDate(transaction.date)}</span>
                    <strong>{transaction.description || transaction.category}</strong>
                    <span>{transaction.category}</span>
                    <span className={transaction.transaction_type}>
                      {transaction.transaction_type}
                      {transaction.transaction_type === "income" && transaction.frequency
                        ? ` \u00b7 ${FREQUENCY_LABELS[transaction.frequency] || transaction.frequency}`
                        : ""}
                    </span>
                    <b>{formatUGX(transaction.amount)}</b>
                  </div>
                ))}
                {transactions.length === 0 && <p className="empty-state">No transactions found.</p>}
              </div>
            </article>

            <article className="panel">
              <div className="section-heading">
                <h2>Add Transaction</h2>
              </div>
              <form className="stack-form" onSubmit={handleSubmit}>
                <label htmlFor="transaction_type">Type</label>
                <select
                  id="transaction_type"
                  value={form.transaction_type}
                  onChange={(event) => setForm({ ...form, transaction_type: event.target.value })}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>

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
                <input
                  id="category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  required
                />

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

                <button type="submit">Add transaction</button>
              </form>
              {message && (
                <p className={`form-message${message === "Transaction added." ? " success" : " error"}`}>
                  {message}
                </p>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Transactions;
