import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatDate, formatUGX } from "../utils";

const EMPTY_FORM = {
  name: "",
  target_amount: "",
  saved_amount: "0",
  deadline: "",
};

function formFromGoal(goal) {
  return {
    name: goal.name || "",
    target_amount: String(goal.target_amount ?? ""),
    saved_amount: String(goal.saved_amount ?? 0),
    deadline: goal.deadline ? String(goal.deadline).slice(0, 10) : "",
  };
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    target_amount: Number(form.target_amount),
    saved_amount: Number(form.saved_amount),
    deadline: form.deadline ? `${form.deadline}T00:00:00` : null,
  };
}

async function fetchGoals() {
  const data = await apiRequest("/goals/");
  if (!Array.isArray(data)) {
    throw new Error("The server returned an unexpected savings goals response.");
  }
  return data;
}

function Goals() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [contributions, setContributions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [isMessageError, setIsMessageError] = useState(false);
  const isMounted = useRef(true);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchGoals();
      if (isMounted.current) {
        setLoadError("");
        setGoals(data);
      }
    } catch (error) {
      if (isMounted.current) setLoadError(error.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    let isCurrent = true;
    fetchGoals()
      .then((data) => {
        if (isCurrent) {
          setLoadError("");
          setGoals(data);
        }
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    window.addEventListener("focus", loadGoals);
    return () => window.removeEventListener("focus", loadGoals);
  }, [loadGoals]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function startEditing(goal) {
    setEditingGoalId(goal.id);
    setForm(formFromGoal(goal));
    setMessage("");
    setIsMessageError(false);
  }

  function cancelEditing() {
    setEditingGoalId(null);
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsMessageError(false);

    const targetAmount = Number(form.target_amount);
    const savedAmount = Number(form.saved_amount);
    if (!form.name.trim() || form.name.trim().length < 2) {
      setIsMessageError(true);
      setMessage("Goal name must be at least 2 characters.");
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setIsMessageError(true);
      setMessage("Enter a target amount greater than zero.");
      return;
    }
    if (!Number.isFinite(savedAmount) || savedAmount < 0) {
      setIsMessageError(true);
      setMessage("Current savings must be zero or more.");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = editingGoalId !== null;
      await apiRequest(
        isEditing ? `/goals/${editingGoalId}` : "/goals/",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(toPayload(form)),
        },
      );
      setForm(EMPTY_FORM);
      setEditingGoalId(null);
      setMessage(isEditing ? "Savings goal updated." : "Savings goal created.");
      await loadGoals();
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "Could not save this goal.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleContribution(event, goal) {
    event.preventDefault();
    const amount = Number(contributions[goal.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setIsMessageError(true);
      setMessage("Enter a contribution greater than zero.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setIsMessageError(false);
    try {
      await apiRequest(`/goals/${goal.id}/contribute`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setContributions((current) => ({ ...current, [goal.id]: "" }));
      setMessage(`Contribution added to ${goal.name}.`);
      await loadGoals();
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "Could not add this contribution.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(goal) {
    if (!window.confirm(`Delete the savings goal "${goal.name}"?`)) return;

    setIsSaving(true);
    setMessage("");
    setIsMessageError(false);
    try {
      await apiRequest(`/goals/${goal.id}`, { method: "DELETE" });
      if (editingGoalId === goal.id) cancelEditing();
      setMessage("Savings goal deleted.");
      await loadGoals();
    } catch (error) {
      setIsMessageError(true);
      setMessage(error.message || "Could not delete this goal.");
    } finally {
      setIsSaving(false);
    }
  }

  const completedCount = goals.filter((goal) => goal.is_completed).length;
  const totalTarget = goals.reduce(
    (total, goal) => total + (Number(goal.target_amount) || 0),
    0,
  );
  const totalSaved = goals.reduce(
    (total, goal) => total + (Number(goal.saved_amount) || 0),
    0,
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page goals-page">
          <header className="page-header">
            <div>
              <h1>Savings Goals</h1>
              <p>Give your plans a target and track your progress over time.</p>
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

          <section className="summary-grid three goals-summary">
            <article className="summary-card">
              <span className="card-icon green">G</span>
              <h3>Active goals</h3>
              <p>{goals.length - completedCount}</p>
              <small>{completedCount} completed</small>
            </article>
            <article className="summary-card">
              <span className="card-icon teal">S</span>
              <h3>Total saved toward goals</h3>
              <p>{formatUGX(totalSaved)}</p>
              <small>Across all your savings goals</small>
            </article>
            <article className="summary-card">
              <span className="card-icon amber">T</span>
              <h3>Total goal targets</h3>
              <p>{formatUGX(totalTarget)}</p>
              <small>Combined target amounts</small>
            </article>
          </section>

          <section className="goals-layout">
            <article className="panel goal-form-panel">
              <div className="section-heading">
                <h2>{editingGoalId === null ? "Create a savings goal" : "Edit savings goal"}</h2>
                <p>Name your goal and enter its target in UGX.</p>
              </div>
              <form className="stack-form" onSubmit={handleSubmit}>
                <div className="field-group">
                  <label htmlFor="goal-name">Goal name</label>
                  <input
                    id="goal-name"
                    type="text"
                    autoComplete="off"
                    maxLength={100}
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="e.g. Emergency fund"
                    required
                    minLength={2}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="goal-target">Target amount (UGX)</label>
                  <input
                    id="goal-target"
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.target_amount}
                    onChange={(event) => updateField("target_amount", event.target.value)}
                    placeholder="e.g. 500000"
                    required
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="goal-saved">Current savings (UGX)</label>
                  <input
                    id="goal-saved"
                    type="number"
                    min="0"
                    step="any"
                    value={form.saved_amount}
                    onChange={(event) => updateField("saved_amount", event.target.value)}
                    required
                  />
                  <small className="muted-text">
                    You can also record future contributions on each goal.
                  </small>
                </div>
                <div className="field-group">
                  <label htmlFor="goal-deadline">Target date (optional)</label>
                  <input
                    id="goal-deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(event) => updateField("deadline", event.target.value)}
                  />
                </div>
                <div className="goal-form-actions">
                  <button type="submit" disabled={isSaving}>
                    {isSaving
                      ? "Saving..."
                      : editingGoalId === null
                        ? "Create goal"
                        : "Save changes"}
                  </button>
                  {editingGoalId !== null && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </article>

            <section className="goal-list-section" aria-labelledby="goal-list-title">
              <div className="section-heading row-heading">
                <div>
                  <h2 id="goal-list-title">Your goals</h2>
                  <p>Track progress and add savings as you go.</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={loadGoals}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {loadError && (
                <div className="form-message error" role="alert">
                  <span>{loadError}</span>
                  <button type="button" onClick={loadGoals} disabled={isLoading}>
                    Retry
                  </button>
                </div>
              )}

              {isLoading ? (
                <p className="empty-state panel">Loading your savings goals...</p>
              ) : loadError ? null : goals.length === 0 ? (
                <p className="empty-state panel">
                  You haven’t created any savings goals yet. Use the form to create your first
                  one.
                </p>
              ) : (
                <div className="goal-card-list">
                  {goals.map((goal) => {
                    const saved = Number(goal.saved_amount);
                    const target = Number(goal.target_amount);
                    const progressValue = Number(goal.percent_saved);
                    const progress = Number.isFinite(progressValue)
                      ? Math.max(0, Math.min(100, progressValue))
                      : 0;
                    const remaining = Number(goal.amount_remaining);
                    return (
                      <article className="panel goal-card" key={goal.id}>
                        <div className="goal-card-heading">
                          <div>
                            <h3>{goal.name || "Savings goal"}</h3>
                            <span className="muted-text">
                              {goal.deadline
                                ? `Target date: ${formatDate(goal.deadline)}`
                                : "No target date set"}
                            </span>
                          </div>
                          {goal.is_completed && (
                            <span className="goal-complete-badge">Completed</span>
                          )}
                        </div>

                        <div className="goal-amount-row">
                          <strong>{formatUGX(Number.isFinite(target) ? target : 0)}</strong>
                          <span>{progress}% complete</span>
                        </div>
                        <div
                          className="meter large"
                          role="progressbar"
                          aria-label={`${goal.name || "Savings goal"} progress`}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={progress}
                        >
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <div className="goal-progress-details">
                          <span>
                            Saved: {formatUGX(Number.isFinite(saved) ? saved : 0)}
                          </span>
                          <span>
                            Remaining: {formatUGX(Number.isFinite(remaining) ? remaining : 0)}
                          </span>
                        </div>
                        {goal.monthly_needed !== null &&
                          goal.monthly_needed !== undefined && (
                            <p className="data-note">
                              Suggested pace: {formatUGX(goal.monthly_needed)} per month
                            </p>
                          )}

                        <form
                          className="goal-contribution-form"
                          onSubmit={(event) => handleContribution(event, goal)}
                        >
                          <div className="field-group">
                            <label htmlFor={`contribution-${goal.id}`}>
                              Add contribution (UGX)
                            </label>
                            <input
                              id={`contribution-${goal.id}`}
                              type="number"
                              min="0.01"
                              step="any"
                              value={contributions[goal.id] || ""}
                              onChange={(event) =>
                                setContributions((current) => ({
                                  ...current,
                                  [goal.id]: event.target.value,
                                }))
                              }
                              placeholder="Amount"
                            />
                          </div>
                          <button type="submit" disabled={isSaving}>
                            Add savings
                          </button>
                        </form>

                        <div className="goal-card-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => startEditing(goal)}
                            disabled={isSaving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleDelete(goal)}
                            disabled={isSaving}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Goals;
