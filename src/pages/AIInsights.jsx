import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";
import { formatUGX } from "../utils";

function AIInsights() {
  const [insights, setInsights] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest("/transactions/insights/summary")
      .then(setInsights)
      .catch((err) => setMessage(err.message));
  }, []);

  async function askQuestion(event) {
    event.preventDefault();
    setMessage("");
    setAnswer("");
    try {
      const data = await apiRequest("/transactions/insights/question", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setAnswer(data.answer);
    } catch (err) {
      setMessage(err.message);
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
              <h1>AI Financial Insights</h1>
              <p>Get personalized insights and recommendations based on your spending habits.</p>
            </div>
          </header>

          {message && <p className="form-message error">{message}</p>}

          <section className="ai-hero panel">
            <div className="ai-bot">AI</div>
            <div>
              <h2>Your Financial Insights</h2>
              <p>{insights?.summary || "Based on your recent transactions and spending patterns."}</p>
            </div>
          </section>

          {insights?.total_income || insights?.total_expenses ? (
            <section className="insight-grid">
              <article className="panel insight-card">
                <span className="card-icon green">T</span>
                <h3>Spending Trend</h3>
                <p>Your tracked transactions are ready for analysis.</p>
              </article>
              <article className="panel insight-card">
                <span className="card-icon amber">S</span>
                <h3>Savings Tip</h3>
                <p>Review your largest category first for quick savings.</p>
              </article>
              <article className="panel insight-card">
                <span className="card-icon violet">G</span>
                <h3>Goal Progress</h3>
                <p>Keep recording income and expenses to improve goal tracking.</p>
              </article>
            </section>
          ) : (
            <section className="panel">
              <p className="empty-state">Add transactions to unlock personalized insights.</p>
            </section>
          )}

          <section className="content-grid">
            <article className="panel">
              <div className="section-heading">
                <h2>Quick Actions</h2>
              </div>
              <div className="quick-actions">
                <button type="button">View Detailed Report</button>
                <button type="button">Set a Savings Goal</button>
                <button type="button">Get More Insights</button>
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
                <button type="submit">Ask question</button>
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
