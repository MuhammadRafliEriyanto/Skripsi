import mongoose from "mongoose";
import dotenv from "dotenv";
import { Payment } from "../models/Payment";
import { User } from "../models/User";
dotenv.config({ path: "../../.env" });
async function run() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(process.env.MONGODB_URI);
  const payments = await Payment.find({ archivedAt: null }).lean();
  const groups: Record<string, any[]> = {};
  for(const p of payments) {
    const key = p.userId.toString() + "_" + p.amount;
    if(!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  const dups = Object.values(groups).filter((g: any[]) => g.length > 1);
  console.log("Groups of dups:", dups.length);
  if(dups.length > 0) {
    const user = await User.findById(dups[0][0].userId);
    console.log("Example User:", user?.email);
    console.log(JSON.stringify(dups[0].map((p: any) => ({
      _id: p._id,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      status: p.status
    })), null, 2));
  }
  await mongoose.disconnect();
}
run().catch(console.error);
