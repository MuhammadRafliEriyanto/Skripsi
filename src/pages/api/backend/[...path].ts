import type { NextApiRequest, NextApiResponse } from "next";

import app from "../../../../backend/src/app";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return app(req, res);
}
