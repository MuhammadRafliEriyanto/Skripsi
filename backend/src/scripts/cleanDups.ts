import "dotenv/config";
import mongoose from "mongoose";
import { validateEnv } from "../config/env";
import { Payment } from "../models/Payment";
import { Subscription } from "../models/Subscription";

async function run() {
  const env = validateEnv();
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB.");

  const payments = await Payment.find({ archivedAt: null }).lean();
  console.log(`Total payments found: ${payments.length}`);

  const groups: Record<string, any[]> = {};
  for (const p of payments) {
    const key = `${p.userId.toString()}_${p.packageKey}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const dups = Object.values(groups).filter(g => g.length > 1);
  console.log(`Found ${dups.length} users with multiple payments for the same package.`);

  let deletedCount = 0;
  for (const group of dups) {
    // Sort by createdAt descending (newest first)
    group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Keep the first one, delete the rest
    const toDelete = group.slice(1);
    for (const p of toDelete) {
      await Payment.deleteOne({ _id: p._id });
      deletedCount++;
    }
  }

  console.log(`Successfully deleted ${deletedCount} duplicate payments.`);
  await mongoose.disconnect();
}

run().catch(console.error);