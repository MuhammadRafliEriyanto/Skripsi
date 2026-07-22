import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import {
  MEMBERSHIP_EXPIRY_EMAIL_REMINDER_DAYS,
  sendMembershipExpiryReminderIfNeeded,
} from "../utils/membershipExpiryReminder";

const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;
const MEMBERSHIP_EXPIRY_REMINDER_JOB_INTERVAL_MS = 6 * 60 * 60 * 1000;

let interval: NodeJS.Timeout | null = null;
let isRunning = false;

async function runMembershipExpiryReminderJob() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  const now = new Date();
  const reminderWindowEnd = new Date(
    now.getTime() + MEMBERSHIP_EXPIRY_EMAIL_REMINDER_DAYS * DAY_IN_MILLISECONDS,
  );

  try {
    const subscriptions = await Subscription.find({
      paymentStatus: "paid",
      endDate: {
        $gte: now,
        $lte: reminderWindowEnd,
      },
    })
      .limit(500)
      .exec();

    let sentCount = 0;

    for (const subscription of subscriptions) {
      const user = await User.findById(subscription.userId)
        .select("nama email")
        .exec();
      const result = await sendMembershipExpiryReminderIfNeeded({
        subscription,
        user,
        now,
      });

      if (result.sent) {
        sentCount += 1;
      }
    }

    if (subscriptions.length > 0) {
      console.log(
        `[membership-reminder] checked=${subscriptions.length} sent=${sentCount}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("[membership-reminder] job failed:", message);
  } finally {
    isRunning = false;
  }
}

export function startMembershipExpiryReminderJob() {
  if (interval) {
    return;
  }

  void runMembershipExpiryReminderJob();
  interval = setInterval(
    () => {
      void runMembershipExpiryReminderJob();
    },
    MEMBERSHIP_EXPIRY_REMINDER_JOB_INTERVAL_MS,
  );
}
