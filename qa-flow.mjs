// End-to-end check of: login -> Budget page -> "+ Add Income" modal -> submit
// -> verify Dashboard and Budget reflect the new income.
export default async function run(page, ui) {
  const out = { steps: [] };
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // --- Log in -------------------------------------------------------------
  await page.waitForSelector("input", { timeout: 15000 });
  const loginSnap = await ui.snapshot();
  out.steps.push({ loginFields: loginSnap.slice(0, 400) });
``
  const emailField = loginSnap.match(/@(e\d+) textbox/);
  const inputs = page.locator("input");
  const count = await inputs.count();
  await inputs.nth(0).fill("qa.income@example.com");
  if (count > 1) await inputs.nth(1).fill("Passw0rd!23");

  const signIn = page
    .getByRole("button", { name: /log ?in|sign ?in/i })
    .first();
  await signIn.click();
  await page.waitForTimeout(2500);
  out.afterLoginUrl = page.url();

  // --- Go to the Budget page ---------------------------------------------
  await page.goto("http://127.0.0.1:5173/budgets", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  out.budgetUrl = page.url();

  const budgetText = await page.locator("main").innerText();
  out.budgetEmptyStateLookedRight = /Total Income/i.test(budgetText);

  // Totals before adding income.
  out.before = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".summary-card")].map((c) =>
      c.innerText.replace(/\n/g, " | "),
    );
    return { cards };
  });

  // --- Open the modal via the "+ Add Income" button -----------------------
  const snap = await ui.snapshot();
  const addIncome = snap.match(/@(e\d+) button "\+ Add Income"/);
  out.foundAddIncomeButton = Boolean(addIncome);
  if (!addIncome) {
    out.snapshot = snap.slice(0, 1500);
    return out;
  }

  await ui.click(addIncome[1]);
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.waitForTimeout(400);

  const modalText = await page.locator('[role="dialog"]').innerText();
  out.modal = modalText.replace(/\n+/g, " | ");
  out.modalHasAllFields = [
    "Amount (UGX)",
    "Income source",
    "Date received",
    "Note (optional)",
    "Cancel",
    "Add Income",
  ].every((label) => modalText.includes(label));

  // --- Validation: submit empty first ------------------------------------
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Add Income" })
    .click();
  await page.waitForTimeout(500);
  const afterInvalid = await page.locator('[role="dialog"]').innerText();
  out.validationMessage = afterInvalid.includes("Amount is required")
    ? "Amount is required"
    : afterInvalid.replace(/\n+/g, " | ").slice(0, 300);

  // --- Fill it in and submit ---------------------------------------------
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator('input[type="number"]').fill("500000");
  await dialog.locator("select").first().selectOption("Business");
  await dialog.locator('input[type="date"]').fill("2026-09-23");
  await dialog
    .locator('input[type="text"], input:not([type])')
    .last()
    .fill("QA modal income");

  const beforeCount = await page.evaluate(
    () => document.querySelectorAll(".summary-card").length,
  );
  await dialog.getByRole("button", { name: "Add Income" }).click();
  await page.waitForTimeout(1200);

  const successText = await page
    .locator('[role="dialog"]')
    .innerText()
    .catch(() => "");
  out.successShown = /Income added/i.test(successText);

  // Modal should close itself and the page data should refresh.
  await page.waitForTimeout(1500);
  out.modalClosed = (await page.locator('[role="dialog"]').count()) === 0;

  const afterText = await page.locator("main").innerText();
  out.after = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".summary-card")].map((c) =>
      c.innerText.replace(/\n/g, " | "),
    );
    return { cards };
  });
  out.budgetMentionsNewAmount = /550,000|1,050,000/.test(afterText);
  out.recentIncomeVisible = /QA modal income|Business/.test(afterText);

  // --- Dashboard should show the new income ------------------------------
  await page.goto("http://127.0.0.1:5173/dashboard", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  const dashText = await page.locator("main").innerText();
  out.dashboardIncome =
    (dashText.match(/Total Income\s+([^\n]+)/) || [])[1] || null;
  out.dashboardBalance =
    (dashText.match(/Balance\s+([^\n]+)/) || [])[1] || null;
  out.dashboardShowsNewIncome = /550,000|1,050,000/.test(dashText);

  // --- Transactions page should list the new income ----------------------
  await page.goto("http://127.0.0.1:5173/transactions", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  const txText = await page.locator("main").innerText();
  out.transactionsShowsNewIncome = /QA modal income/.test(txText);
  out.transactionsStillHasTable =
    /Date\s+Description\s+Category\s+Type\s+Amount/.test(txText);

  out.consoleErrors = errors.slice(0, 10);
  return out;
}
