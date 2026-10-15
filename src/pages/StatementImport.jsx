import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatDate } from "../utils";

function uploadForm(accountId, file) {
  const body = new FormData();
  body.append("account_id", accountId);
  body.append("file", file);
  return body;
}

function formatAmount(amount, currency) {
  if (amount === null || amount === undefined) return "—";
  return `${currency} ${amount}`;
}

function StatementImport() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [isMessageError, setIsMessageError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    apiRequest("/financial-accounts/")
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("The server returned an unexpected accounts response.");
        }
        if (isCurrent) {
          setAccounts(data);
          setAccountId(data[0] ? String(data[0].id) : "");
        }
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || "Could not load your accounts.");
      })
      .finally(() => {
        if (isCurrent) setIsLoadingAccounts(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  function clearPreview() {
    setFile(null);
    setPreview(null);
    const input = document.getElementById("statement-file");
    if (input) input.value = "";
  }

  function retryLoadAccounts() {
    setLoadError("");
    setIsLoadingAccounts(true);
    apiRequest("/financial-accounts/")
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("The server returned an unexpected accounts response.");
        }
        setAccounts(data);
        setAccountId(data[0] ? String(data[0].id) : "");
      })
      .catch((error) => {
        setLoadError(error.message || "Could not load your accounts.");
      })
      .finally(() => setIsLoadingAccounts(false));
  }

  async function handlePreview(event) {
    event.preventDefault();
    setMessage("");
    setIsMessageError(false);
    setPreview(null);
    if (!file || !accountId) {
      setIsMessageError(true);
      setMessage("Choose a financial account and a CSV statement to continue.");
      return;
    }

    setIsPreviewing(true);
    try {
      const data = await apiRequest("/transactions/import/preview", {
        method: "POST",
        body: uploadForm(accountId, file),
      });
      setPreview(data);
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "Could not preview this statement.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file || !preview || isImporting || preview.importable_count < 1) return;
    const confirmed = window.confirm(
      `Import ${preview.importable_count} transaction${preview.importable_count === 1 ? "" : "s"} into ${preview.account_name}? ` +
        `${preview.duplicate_count} duplicate row(s) will be skipped and ${preview.invalid_count} invalid row(s) rejected.`,
    );
    if (!confirmed) return;

    setIsImporting(true);
    setMessage("");
    setIsMessageError(false);
    try {
      const result = await apiRequest("/transactions/import", {
        method: "POST",
        body: uploadForm(accountId, file),
      });
      setMessage(
        `Import complete: ${result.imported_count} imported, ` +
          `${result.skipped_duplicate_count} duplicate${result.skipped_duplicate_count === 1 ? "" : "s"} skipped, ` +
          `${result.rejected_count} invalid row${result.rejected_count === 1 ? "" : "s"} rejected.`,
      );
      clearPreview();
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "The statement could not be imported.");
    } finally {
      setIsImporting(false);
    }
  }

  const selectedAccount = accounts.find((account) => String(account.id) === accountId);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page statement-import-page">
          <header className="page-header">
            <div>
              <h1>Import a Statement</h1>
              <p>Import transactions from a CSV statement you provide. Accounts do not sync automatically.</p>
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
          {loadError && (
            <div className="form-message error" role="alert">
              <span>{loadError}</span>
              <button type="button" onClick={retryLoadAccounts} disabled={isLoadingAccounts}>
                Retry
              </button>
            </div>
          )}

          <section className="statement-import-layout">
            <article className="panel statement-import-form">
              <div className="section-heading">
                <h2>Choose a statement</h2>
                <p>Files are processed transiently and not retained.</p>
              </div>
              {isLoadingAccounts ? (
                <p className="empty-state" role="status">Loading your financial accounts...</p>
              ) : accounts.length === 0 ? (
                <div className="empty-state">
                  <p>Add a financial account before importing a statement.</p>
                  <Link className="primary-action statement-link" to="/accounts">Go to Financial Accounts</Link>
                </div>
              ) : (
                <form className="stack-form" onSubmit={handlePreview}>
                  <div className="field-group">
                    <label htmlFor="statement-account">Import to account</label>
                    <select
                      id="statement-account"
                      value={accountId}
                      onChange={(event) => {
                        setAccountId(event.target.value);
                        setPreview(null);
                      }}
                      required
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="statement-file">CSV file</label>
                    <input
                      id="statement-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] || null);
                        setPreview(null);
                      }}
                      required
                    />
                    <small className="muted-text">
                      Maximum 5 MiB and 1,000 rows. Use UTF-8 or UTF-8 with BOM.
                    </small>
                  </div>
                  <div className="csv-format-note">
                    <strong>Supported CSV columns</strong>
                    <code>date,description,amount,transaction_type,category</code>
                    <span>
                      Required: date, description, amount, transaction_type. Category is optional.
                      Use ISO dates, positive decimal amounts (up to 8 decimals), and income or expense.
                    </span>
                    <span>Transfers are not imported and will be marked for review.</span>
                  </div>
                  <button type="submit" disabled={isPreviewing}>
                    {isPreviewing ? "Checking statement..." : "Preview transactions"}
                  </button>
                </form>
              )}
            </article>

            <section className="statement-preview-section" aria-labelledby="statement-preview-title">
              <div className="section-heading row-heading">
                <div>
                  <h2 id="statement-preview-title">Preview</h2>
                  <p>Nothing is saved until you confirm the import.</p>
                </div>
              </div>
              {!preview ? (
                <p className="empty-state panel statement-preview-empty">
                  Select an account and CSV file to check the transactions before importing.
                </p>
              ) : (
                <>
                  <div className="summary-grid three statement-counts">
                    <article className="summary-card">
                      <h3>Ready to import</h3>
                      <p>{preview.importable_count}</p>
                    </article>
                    <article className="summary-card">
                      <h3>Duplicates skipped</h3>
                      <p>{preview.duplicate_count}</p>
                    </article>
                    <article className="summary-card">
                      <h3>Rows needing review</h3>
                      <p>{preview.invalid_count}</p>
                    </article>
                  </div>
                  <div className="statement-preview-actions">
                    <p>
                      Target account: <strong>{preview.account_name}</strong> ({preview.currency})
                      {selectedAccount && selectedAccount.id !== preview.account_id
                        ? " · Account selection changed; preview again before importing."
                        : ""}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={handleImport}
                        disabled={
                          isImporting ||
                          isPreviewing ||
                          preview.importable_count < 1 ||
                          !selectedAccount ||
                          selectedAccount.id !== preview.account_id
                        }
                      >
                        {isImporting ? "Importing..." : `Import ${preview.importable_count} transactions`}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={clearPreview}
                        disabled={isImporting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="statement-table-wrap">
                    <table className="statement-table">
                      <thead>
                        <tr>
                          <th scope="col">Row</th>
                          <th scope="col">Date</th>
                          <th scope="col">Description</th>
                          <th scope="col">Type</th>
                          <th scope="col">Category</th>
                          <th scope="col">Amount</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={row.line_number}>
                            <td>{row.line_number}</td>
                            <td>{row.date ? formatDate(row.date) : "—"}</td>
                            <td className="statement-description">{row.description || "—"}</td>
                            <td>{row.transaction_type || "—"}</td>
                            <td>{row.category || "—"}</td>
                            <td>{formatAmount(row.amount, preview.currency)}</td>
                            <td>
                              <span className={`import-status ${row.status}`}>
                                {row.status === "valid"
                                  ? "Ready"
                                  : row.status === "duplicate"
                                    ? "Duplicate"
                                    : "Review"}
                              </span>
                              {row.errors.length > 0 && (
                                <small className="import-row-error">{row.errors.join(" ")}</small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

export default StatementImport;
