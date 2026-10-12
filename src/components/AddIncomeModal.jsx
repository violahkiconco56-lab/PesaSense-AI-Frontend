import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";
import { formatUGX, notifyTransactionsChanged } from "../utils";
import {
  INCOME_FREQUENCIES,
  INCOME_SOURCES,
  blankIncomeForm,
  buildIncomePayload,
  friendlyError,
  resolveIncomeSource,
  validateIncomeForm,
} from "../income";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal for recording income without leaving the current page.
 *
 * Saves through the existing POST /transactions/ endpoint (transaction_type
 * "income"), so the result is a real transaction row that every other page
 * already reads. `onSaved` receives the created transaction.
 */
function AddIncomeModal({ onClose, onSaved }) {
  const [form, setForm] = useState(blankIncomeForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const dialogRef = useRef(null);
  const amountRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    return () => {
      // Hand focus back to the button that opened the modal.
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    amountRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      // Keep keyboard focus inside the dialog while it is open.
      const nodes = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
    if (isError) {
      setIsError(false);
      setMessage("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateIncomeForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setIsError(true);
      setMessage("Please fix the highlighted fields.");
      return;
    }

    setErrors({});
    setIsError(false);
    setMessage("");
    setIsSaving(true);

    try {
      const created = await apiRequest("/transactions/", {
        method: "POST",
        body: JSON.stringify(buildIncomePayload(form, Number(form.amount))),
      });

      setIsSaving(false);
      setIsSaved(true);
      setMessage("Income added. Your dashboard and budgets are updated.");
      setForm(blankIncomeForm());
      // Tell every mounted page (Dashboard, Budgets, Transactions) to re-read
      // its totals from the existing transaction APIs.
      notifyTransactionsChanged();
      // Let the success state register, then close and refresh the pages.
      await new Promise((resolve) => setTimeout(resolve, 750));
      if (typeof onSaved === "function") {
        await onSaved(created);
      }
      onClose();
    } catch (error) {
      // Never clear the form on failure so the user keeps what they typed.
      setIsSaving(false);
      setIsError(true);
      setMessage(friendlyError(error));
    }
  }

  const hasCustomSource = form.category === "Other";
  const previewSource = resolveIncomeSource(form);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-income-title"
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 id="add-income-title">Add Income</h2>
            <p>Record money you received. It is saved to your transactions.</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close add income dialog"
          >
            &times;
          </button>
        </header>

        <form
          className="modal-body income-modal-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="field-group">
            <label htmlFor="modal-income-amount">Amount (UGX)</label>
            <input
              id="modal-income-amount"
              ref={amountRef}
              type="number"
              min="1"
              step="any"
              inputMode="numeric"
              placeholder="e.g. 500000"
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
              className={errors.amount ? "input-error" : ""}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={
                errors.amount ? "modal-income-amount-error" : undefined
              }
            />
            {errors.amount && (
              <span className="field-error" id="modal-income-amount-error">
                {errors.amount}
              </span>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="modal-income-source">Income source</label>
            <select
              id="modal-income-source"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              className={errors.category ? "input-error" : ""}
              aria-invalid={Boolean(errors.category)}
            >
              {INCOME_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            {errors.category && (
              <span className="field-error">{errors.category}</span>
            )}
          </div>

          {hasCustomSource && (
            <div className="field-group">
              <label htmlFor="modal-income-custom">Name the source</label>
              <input
                id="modal-income-custom"
                placeholder="e.g. Poultry sales"
                value={form.customCategory}
                onChange={(event) =>
                  updateField("customCategory", event.target.value)
                }
                className={errors.category ? "input-error" : ""}
                aria-invalid={Boolean(errors.category)}
              />
            </div>
          )}

          <div className="field-group">
            <label htmlFor="modal-income-date">Date received</label>
            <input
              id="modal-income-date"
              type="date"
              value={form.date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => updateField("date", event.target.value)}
              className={errors.date ? "input-error" : ""}
              aria-invalid={Boolean(errors.date)}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </div>

          <fieldset className="frequency-picker">
            <legend>How often do you earn this?</legend>
            <div className="frequency-options">
              {INCOME_FREQUENCIES.map((option) => (
                <label
                  key={option.value}
                  className={`frequency-option${
                    form.frequency === option.value ? " selected" : ""
                  }${errors.frequency ? " input-error" : ""}`}
                >
                  <input
                    type="radio"
                    name="modal-income-frequency"
                    value={option.value}
                    checked={form.frequency === option.value}
                    onChange={() => updateField("frequency", option.value)}
                  />
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </label>
              ))}
            </div>
            {errors.frequency && (
              <span className="field-error">{errors.frequency}</span>
            )}
          </fieldset>

          <div className="field-group modal-note-field">
            <label htmlFor="modal-income-note">Note (optional)</label>
            <input
              id="modal-income-note"
              maxLength={255}
              placeholder="e.g. September salary"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              className={errors.description ? "input-error" : ""}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && (
              <span className="field-error">{errors.description}</span>
            )}
          </div>

          {previewSource && Number(form.amount) > 0 && !isSaved && (
            <p className="modal-preview">
              Adding <strong>{formatUGX(Number(form.amount))}</strong> from{" "}
              <strong>{previewSource}</strong>
            </p>
          )}

          {message && (
            <p
              className={`form-message modal-message${isError ? " error" : " success"}`}
              role={isError ? "alert" : "status"}
            >
              {message}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSaving || isSaved}
            >
              {isSaved ? "Added" : isSaving ? "Adding..." : "Add Income"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddIncomeModal;
