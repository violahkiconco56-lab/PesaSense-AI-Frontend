import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatDate } from "../utils";

const ACCOUNT_TYPES = [
  { value: "mtn_mobile_money", label: "MTN Mobile Money", shortLabel: "MTN MoMo" },
  { value: "airtel_money", label: "Airtel Money", shortLabel: "Airtel Money" },
  { value: "bank", label: "Bank", shortLabel: "Bank" },
  { value: "manual", label: "Manual", shortLabel: "Manual" },
];

const EMPTY_FORM = { name: "", account_type: "mtn_mobile_money", currency: "UGX" };

function accountTypeLabel(type) {
  return ACCOUNT_TYPES.find((item) => item.value === type)?.label || "Account";
}

function formFromAccount(account) {
  return {
    name: account.name || "",
    account_type: account.account_type || "manual",
    currency: account.currency || "UGX",
  };
}

async function fetchFinancialAccounts() {
  const data = await apiRequest("/financial-accounts/");
  if (!Array.isArray(data)) {
    throw new Error("The server returned an unexpected financial accounts response.");
  }
  return data;
}

function FinancialAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [isMessageError, setIsMessageError] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchFinancialAccounts();
      setAccounts(data);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message || "Could not load your financial accounts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    setIsLoading(true);
    await loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    let isCurrent = true;
    fetchFinancialAccounts()
      .then((data) => {
        if (isCurrent) {
          setAccounts(data);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setLoadError(error.message || "Could not load your financial accounts.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function startEditing(account) {
    setEditingAccountId(account.id);
    setForm(formFromAccount(account));
    setMessage("");
    setIsMessageError(false);
  }

  function cancelEditing() {
    setEditingAccountId(null);
    setForm(EMPTY_FORM);
    setMessage("");
    setIsMessageError(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsMessageError(false);

    const name = form.name.trim();
    const currency = form.currency.trim().toUpperCase();
    if (name.length < 2 || name.length > 100) {
      setIsMessageError(true);
      setMessage("Account name must be between 2 and 100 characters.");
      return;
    }
    if (!ACCOUNT_TYPES.some((item) => item.value === form.account_type)) {
      setIsMessageError(true);
      setMessage("Choose a valid account type.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      setIsMessageError(true);
      setMessage("Currency must be a three-letter code, such as UGX.");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = editingAccountId !== null;
      await apiRequest(
        isEditing
          ? `/financial-accounts/${editingAccountId}`
          : "/financial-accounts/",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify({ name, account_type: form.account_type, currency }),
        },
      );
      setForm(EMPTY_FORM);
      setEditingAccountId(null);
      setMessage(isEditing ? "Financial account updated." : "Financial account added.");
      await refreshAccounts();
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "Could not save this financial account.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(account) {
    if (!window.confirm(`Delete the account "${account.name}"?`)) return;

    setIsSaving(true);
    setMessage("");
    setIsMessageError(false);
    try {
      await apiRequest(`/financial-accounts/${account.id}`, { method: "DELETE" });
      if (editingAccountId === account.id) cancelEditing();
      setMessage("Financial account deleted.");
      await refreshAccounts();
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "Could not delete this financial account.");
    } finally {
      setIsSaving(false);
    }
  }

  const accountTypeCounts = ACCOUNT_TYPES.map((type) => ({
    ...type,
    count: accounts.filter((account) => account.account_type === type.value).length,
  }));

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page financial-accounts-page">
          <header className="page-header">
            <div>
              <h1>Financial Accounts</h1>
              <p>Keep your mobile money, bank, and other accounts organized in one place.</p>
            </div>
          </header>

          {message && (
            <p
              className={`form-message ${isMessageError ? "error" : "success-message"}`}
              role={isMessageError ? "alert" : "status"}
            >
              {message}
            </p>
          )}

          <section className="summary-grid three accounts-summary" aria-label="Account overview">
            <article className="summary-card">
              <span className="card-icon green">A</span>
              <h3>Your accounts</h3>
              <p>{accounts.length}</p>
              <small>Accounts you manage</small>
            </article>
            {accountTypeCounts.slice(0, 2).map((type) => (
              <article className="summary-card" key={type.value}>
                <span className={`card-icon ${type.value === "mtn_mobile_money" ? "teal" : "amber"}`}>
                  {type.shortLabel.slice(0, 1)}
                </span>
                <h3>{type.label}</h3>
                <p>{type.count}</p>
                <small>
                  {type.count === 1 ? "1 account" : `${type.count} accounts`}
                </small>
              </article>
            ))}
          </section>

          <section className="accounts-layout">
            <article className="panel account-form-panel">
              <div className="section-heading">
                <h2>{editingAccountId === null ? "Add an account" : "Edit account"}</h2>
                <p>Account details are private to your signed-in profile.</p>
              </div>
              <form className="stack-form" onSubmit={handleSubmit}>
                <div className="field-group">
                  <label htmlFor="account-name">Account name</label>
                  <input
                    id="account-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="e.g. Main mobile wallet"
                    minLength={2}
                    maxLength={100}
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="account-type">Account type</label>
                  <select
                    id="account-type"
                    value={form.account_type}
                    onChange={(event) => updateField("account_type", event.target.value)}
                    required
                  >
                    {ACCOUNT_TYPES.map((type) => (
                      <option value={type.value} key={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="account-currency">Currency</label>
                  <input
                    id="account-currency"
                    type="text"
                    value={form.currency}
                    onChange={(event) => updateField("currency", event.target.value.toUpperCase())}
                    placeholder="UGX"
                    minLength={3}
                    maxLength={3}
                    pattern="[A-Za-z]{3}"
                    title="Enter a three-letter currency code, such as UGX."
                    autoComplete="off"
                    required
                  />
                  <small className="muted-text">Use a three-letter currency code, such as UGX.</small>
                </div>
                <div className="account-form-actions">
                  <button type="submit" disabled={isSaving}>
                    {isSaving
                      ? "Saving..."
                      : editingAccountId === null
                        ? "Add account"
                        : "Save changes"}
                  </button>
                  {editingAccountId !== null && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </article>

            <section className="account-list-section" aria-labelledby="accounts-list-title">
              <div className="section-heading row-heading">
                <div>
                  <h2 id="accounts-list-title">Your accounts</h2>
                  <p>Review and update the accounts connected to your finances.</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={refreshAccounts}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {loadError && (
                <div className="form-message error" role="alert">
                  <span>{loadError}</span>
                  <button type="button" onClick={refreshAccounts} disabled={isLoading}>
                    Retry
                  </button>
                </div>
              )}

              {isLoading ? (
                <p className="empty-state panel account-list-state" role="status">
                  Loading your financial accounts...
                </p>
              ) : loadError ? null : accounts.length === 0 ? (
                <p className="empty-state panel account-list-state">
                  You haven’t added any financial accounts yet. Add your first account using the form.
                </p>
              ) : (
                <div className="account-card-list">
                  {accounts.map((account) => (
                    <article className="panel account-card" key={account.id}>
                      <div className="account-card-heading">
                        <span className="card-icon green" aria-hidden="true">
                          {accountTypeLabel(account.account_type).slice(0, 1)}
                        </span>
                        <div>
                          <h3>{account.name}</h3>
                          <span>{accountTypeLabel(account.account_type)}</span>
                        </div>
                        <span className="account-currency">{account.currency}</span>
                      </div>
                      <div className="account-card-footer">
                        <small>Added {formatDate(account.created_at)}</small>
                        <div className="account-card-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => startEditing(account)}
                            disabled={isSaving}
                            aria-label={`Edit ${account.name}`}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => handleDelete(account)}
                            disabled={isSaving}
                            aria-label={`Delete ${account.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

export default FinancialAccounts;
