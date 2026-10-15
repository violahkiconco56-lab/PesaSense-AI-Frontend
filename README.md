# PesaSense-AI Frontend

**An AI-powered personal finance management application.**

PesaSense-AI is a personal finance application designed to help users manage their money, monitor spending habits, track budgets, and gain insights into their financial activities.

This repository contains the frontend, built with React and Vite, providing a user-friendly interface that communicates with the PesaSense-AI backend.

## ✨ Features

- **Financial Dashboard** — View income, expenses, and available balance at a glance.
- **Transaction Management** — Track income and expenses in one place.
- **Financial Accounts** — Manage mobile money, bank, and manual accounts.
- **Statement Import** — Preview and import transactions from user-provided CSV statements.
- **Budget Tracking** — Monitor spending against monthly budgets.
- **Spending Insights** — Understand spending patterns across different categories.
- **AI-Powered Financial Insights** — Get intelligent feedback and recommendations based on financial activity.
- **Backend Integration** — Communicate with the FastAPI REST API.
- **Responsive Interface** — Designed to make financial information easy to access and understand.

## 🛠️ Tech Stack

- **React** — Component-based user interface.
- **Vite** — Frontend development server and build tool.
- **JavaScript** — Application logic.
- **CSS** — Styling and layout.
- **FastAPI** — Backend API integration.
- **SQLAlchemy** — Backend database operations.

## 📋 Prerequisites

Before getting started, ensure you have installed:

- Node.js (LTS recommended)
- npm
- Git
- The PesaSense-AI backend, running locally or deployed to a server

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone YOUR_FRONTEND_REPOSITORY_URL
```

### 2. Navigate to the project directory

```bash
cd YOUR_FRONTEND_DIRECTORY
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure the backend connection

Ensure the frontend is configured to communicate with your FastAPI backend.

If your project uses a Vite development proxy, check `vite.config.js` and confirm that the backend target matches your running server.

For example, a local backend running on port `8001` can use this proxy configuration:

```javascript
server: {
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8001",
      changeOrigin: true
    }
  }
}
```

Keep your existing Vite configuration and merge this example into it as needed. Your API routes must match the configured proxy path.

### 5. Start the development server

```bash
npm run dev
```

Open the local URL displayed in your terminal, usually:

```text
http://localhost:5173
```

## 🏗️ Build for Production

To create an optimized production build, run:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## 🔗 Backend Integration

The frontend connects to the PesaSense-AI backend, built with FastAPI, to access application data and financial functionality.

The backend is responsible for authentication, transaction processing, budget management, database operations, and AI-powered financial insights.

Make sure the backend is running and accessible before testing features that require API communication.

### CSV statement imports

Imports use the authenticated endpoints `POST /transactions/import/preview` and
`POST /transactions/import`. The import page previews the selected file before
the user confirms; the file is submitted again for confirmation, processed
transiently, and not retained. Defaults are a 5 MiB upload limit and 1,000 CSV
rows; set `CSV_IMPORT_MAX_BYTES` and `CSV_IMPORT_MAX_ROWS` to adjust them.
Before using imports with an existing database, run
`python -m alembic upgrade head` from the project root. This applies migration
`007` after the user-owned-accounts migration `006`; `create_all` does not
update existing tables.

Use a UTF-8 CSV (an optional UTF-8 BOM is supported) with this header:

```csv
date,description,amount,transaction_type,category
2026-10-01,Groceries,24500,expense,Food
2026-10-02,Salary,1500000,income,Salary
```

The required columns are `date`, `description`, `amount`, and
`transaction_type`; `category` is optional and defaults to `Other`. Dates must
be ISO dates or ISO date-times, amounts must be positive decimal values with up
to eight fractional digits, and types must be `income` or `expense`. Transfers
are not supported and are marked for review rather than classified as income
or expenses. Re-imported statement rows are skipped as duplicates per account.

## 🔐 Security

- Never commit API keys, passwords, access tokens, or other secrets.
- Keep sensitive environment variables out of version control.
- Use HTTPS when communicating with a deployed backend.
- Ensure authenticated API requests are handled securely.

## 🎯 Project Goal

PesaSense-AI aims to make personal financial management more accessible by combining practical budgeting tools with AI-driven insights. The project demonstrates the integration of a modern frontend, REST APIs, backend services, and AI capabilities to address a real-world problem.

## 👩🏽‍💻 Developer

**Violah Kiconco**

Software Engineering | Backend Development | AI Engineering

GitHub: [violahkiconco56-lab](https://github.com/violahkiconco56-lab)

---

*PesaSense-AI — Make informed financial decisions with greater confidence.*