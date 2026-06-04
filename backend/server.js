const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
app.use(express.json());
app.use(cors());

// ================= FIREBASE =================
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================= SUPABASE =================
const supabaseUrl = "https://syqbfynxbhsswmhfezpr.supabase.co";
const supabaseKey = "YOUR_SUPABASE_SECRET_KEY"; // ⚠️ put your real key here

// ================= FETCH LOANS =================
async function fetchLoans() {
  const res = await fetch(`${supabaseUrl}/rest/v1/loans?select=*`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  return await res.json();
}

// ================= FETCH TOKENS =================
async function fetchTokens(user_id) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/device_tokens?user_id=eq.${user_id}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  return await res.json();
}

// ================= SAVE SCHEDULE =================
async function saveSchedule(rows) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/repayment_schedule`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    }
  );

  return res.ok;
}

// ================= GENERATE EMI SCHEDULE =================
function generateSchedule(loan) {
  const schedule = [];
  const start = new Date(loan.issued_on);

  for (let i = 1; i <= 12; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);

    schedule.push({
      loan_id: loan.id,
      user_id: loan.user_id,
      due_date: due.toISOString().split("T")[0],
      amount: loan.monthly_interest,
      status: "pending",
    });
  }

  return schedule;
}

// ================= PUSH NOTIFICATION =================
async function sendPush(token, title, body) {
  return await admin.messaging().send({
    notification: { title, body },
    token,
  });
}

// ================= CREATE SCHEDULE (RUN ON START) =================
async function createSchedules() {
  console.log("🔄 Creating EMI schedules...");

  const loans = await fetchLoans();

  for (const loan of loans) {
    if (loan.status === "closed") continue;

    const schedule = generateSchedule(loan);

    await saveSchedule(schedule);

    console.log("✔ Schedule created for loan:", loan.id);
  }
}

// ================= NOTIFICATION ENGINE =================
cron.schedule("0 9 * * *", async () => {
  console.log("🔔 Running notification engine...");

  const res = await fetch(
    `${supabaseUrl}/rest/v1/repayment_schedule?status=eq.pending`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  const schedule = await res.json();
  const today = new Date().toISOString().split("T")[0];

  for (const item of schedule) {
    const diffDays = Math.ceil(
      (new Date(item.due_date) - new Date(today)) /
        (1000 * 60 * 60 * 24)
    );

    let title = "";
    let body = "";

    if (diffDays === 3) {
      title = "⏳ EMI Reminder";
      body = `₹${item.amount} due in 3 days`;
    } else if (diffDays === 1) {
      title = "⚠️ EMI Tomorrow";
      body = `₹${item.amount} due tomorrow`;
    } else if (diffDays === 0) {
      title = "💰 EMI Due Today";
      body = `₹${item.amount} due today`;
    } else if (diffDays < 0) {
      title = "🚨 EMI Overdue";
      body = `₹${item.amount} overdue`;
    } else {
      continue;
    }

    const tokens = await fetchTokens(item.user_id);

    for (const t of tokens) {
      try {
        await sendPush(t.token, title, body);
        console.log("✔ Sent to:", item.user_id);
      } catch (err) {
        console.log("Push error:", err.message);
      }
    }
  }
});

// ================= TEST PUSH =================
app.get("/test-push", async (req, res) => {
  try {
    const token = req.query.token;

    const response = await admin.messaging().send({
      notification: {
        title: "🔥 FundVault Test",
        body: "System working perfectly",
      },
      token,
    });

    res.json({ success: true, response });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ================= START SERVER =================
app.listen(3001, async () => {
  console.log("🚀 Server running on http://localhost:3001");

  // auto create schedules on startup
  await createSchedules();
});