import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatUGX } from "../utils";

function AIInsights() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);

  async function loadInsights() {
    setIsLoading(true);
    setMessage("");
    try {
      setInsights(await apiRequest("/transactions/insights/summary"));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, []);

  async function askQuestion(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setMessage("");
    setAnswer("");
    setIsAsking(true);
    try {
      const data = await apiRequest("/transactions/insights/question", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setAnswer(data.answer);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsAsking(false);
    }
  }

  const categories = Object.entries(insights?.category_breakdown || {}).sort(
    ([, first], [, second]) => second - first,
  );
  const budgets = insights?.budgets || [];
  const hasData = (insights?.transaction_count || 0) > 0;
  const savingsRate = insights?.savings_rate;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page">
          <header className="page-header">
            <div>
              <h1>AI Financial Insights</h1>
              <p>Get personalized insights and recommendations based on your spending habits.</p>
            </div>
          </header>

          {message && (
            <div className="form-message error">
              <span>{message}</span>
              <button type="button" onClick={loadInsights} disabled={isLoading}>
                {isLoading ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          <section className="ai-hero panel">
            <div className="ai-bot">AI</div>
            <div>
              <h2>Your Financial Insights</h2>
              <p>
                {isLoading
                  ? "Analyzing your financial data..."
                  : insights?.summary || "No AI summary is available yet."}
              </p>
            </div>
          </section>

          {isLoading ? (
            <section className="insight-grid">
              <p className="empty-state panel">Loading your financial metrics...</p>
            </section>
          ) : hasData ? (
            <section className="insight-grid">
              <article className="panel insight-card">
                <span className="card-icon coral">E</span>
                <h3>Total Expenses</h3>
                <p>{formatUGX(insights.total_expenses)}</p>
                <small>{categories[0] ? `Top category: ${categories[0][0]}` : "No expense categories"}</small>
              </article>
              <article className="panel insight-card">
                <span className="card-icon green">S</span>
                <h3>Net Balance</h3>
                <p>{formatUGX(insights.balance)}</p>
                <small>{savingsRate === null ? "No income baseline" : `${savingsRate}% savings rate`}</small>
              </article>
              <article className="panel insight-card">
                <span className="card-icon amber">B</span>
                <h3>Budget Coverage</h3>
                <p>{budgets.length} active budget{budgets.length === 1 ? "" : "s"}</p>
                <small>{budgets.filter((budget) => budget.over_budget).length} over budget</small>
              </article>
            </section>
          ) : (
            <section className="panel">
              <p className="empty-state">Add income or expenses to unlock personalized insights.</p>
            </section>
          )}

          <section className="content-grid">
            <article className="panel">
              <div className="section-heading">
                <h2>Quick Actions</h2>
              </div>
              <div className="quick-actions">
                <button type="button" onClick={() => navigate("/reports")}>View Detailed Report</button>
                <button type="button" onClick={() => navigate("/budgets")}>Review Budgets</button>
                <button type="button" onClick={loadInsights} disabled={isLoading}>
                  {isLoading ? "Analyzing..." : "Refresh Insights"}
                </button>
              </div>
            </article>

            <article className="panel">
              <div className="section-heading">
                <h2>Ask AI</h2>
                <p>Income {formatUGX(insights?.total_income)} | Expenses {formatUGX(insights?.total_expenses)}</p>
              </div>
              <form className="stack-form" onSubmit={askQuestion}>
                <label htmlFor="question">Question</label>
                <textarea
                  id="question"
                  rows="4"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  required
                />
                <button type="submit" disabled={isAsking || isLoading}>
                  {isAsking ? "Thinking..." : "Ask question"}
                </button>
              </form>
              {answer && <p className="answer-box">{answer}</p>}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}

export default AIInsights;
