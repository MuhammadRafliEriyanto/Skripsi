import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

export function uploadQuestionImage(dataUri: string) {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET.");
  }
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "bimbel/question-bank", resource_type: "image" }, (error, result) => {
      if (error || !result?.secure_url || !result.public_id) reject(error ?? new Error("Upload gambar gagal."));
      else resolve({ secure_url: result.secure_url, public_id: result.public_id });
    });
    stream.end(Buffer.from(dataUri.split(",").pop() ?? "", "base64"));
  });
}
