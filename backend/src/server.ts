import "./config/env";

import app from "./app";
import connectDB from "./config/db";
import { validateEnv } from "./config/env";
import { startMembershipExpiryReminderJob } from "./jobs/membershipExpiryReminderJob";
import { verifyEmailTransport } from "./utils/email";

async function startServer(): Promise<void> {
  try {
    const env = validateEnv();

    await connectDB();
    await verifyEmailTransport();
    startMembershipExpiryReminderJob();

    app.listen(env.port, '0.0.0.0', () => {
      console.log(`Auth server running on port ${env.port}`);
      console.log(`Client URL allowed: ${env.clientUrl}`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    console.error("Gagal menjalankan backend auth:", errorMessage);
    process.exit(1);
  }
}

void startServer();
