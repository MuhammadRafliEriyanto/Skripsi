import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI ?? "";

if (!MONGO_URI) {
  throw new Error("MONGO_URI wajib diatur di backend/.env sebelum menjalankan script ini.");
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await mongoose.connection.db?.collection("users").find({
      role: { $in: ["owner", "admin", "guru", "siswa"] }
    }).toArray();

    if (!users) {
        console.log('No users found.');
        return;
    }

    const result = {
      owner: users.find(u => u.role === "owner")?.email,
      admin: users.find(u => u.role === "admin")?.email,
      guru: users.find(u => u.role === "guru")?.email,
      siswa: users.find(u => u.role === "siswa")?.email,
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
