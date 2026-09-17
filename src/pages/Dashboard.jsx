import Sidebar from "./Sidebar";
// import "./Dashboard.css";


function Dashboard() {
  const dashboard = {
    total_income: 50000,
    total_expenses: 45000,
    balance: 5000,
    highest_expense_category: "Food",
    recent_transactions: [
      {
        id: 1,
        description: "Lunch",
        amount: 15000,
      },
      {
        id: 2,
        description: "Transport",
        amount: 10000,
      },
      {
        id: 3,
        description: "Groceries",
        amount: 20000,
      },
    ],
  };

  return (
    <div className="app-layout">
          <Sidebar />

     <main className="dashboard">

      <div className="dashboard-header">
        <h1>PesaSense-AI Dashboard</h1>
        <p>Welcome back!</p>
      </div>

      <div className="summary-grid">

        <div className="summary-card">
          <h3>Total Income</h3>
          <p>UGX {dashboard.total_income.toLocaleString()}</p>
        </div>

        <div className="summary-card">
          <h3>Total Expenses</h3>
          <p>UGX {dashboard.total_expenses.toLocaleString()}</p>
        </div>

        <div className="summary-card">
          <h3>Balance</h3>
          <p>UGX {dashboard.balance.toLocaleString()}</p>
        </div>

        <div className="summary-card">
          <h3>Highest Expense</h3>
          <p>{dashboard.highest_expense_category}</p>
        </div>

      </div>

      <div className="transactions">
        <h2>Recent Transactions</h2>

        {dashboard.recent_transactions.map((transaction) => (
          <div className="transaction" key={transaction.id}>
            <p>{transaction.description}</p>

            <p className="transaction-amount">
              UGX {transaction.amount.toLocaleString()}
            </p>
          </div>
        ))}

      </div>

    </main>
    </div>
  );
}

export default Dashboard;
