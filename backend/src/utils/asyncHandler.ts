import type { NextFunction, Request, RequestHandler, Response } from "express";

import "../types/express";

type AsyncRequestHandler<TRequest extends Request = Request> = (
  req: TRequest,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export default function asyncHandler<TRequest extends Request = Request>(
  handler: AsyncRequestHandler<TRequest>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req as TRequest, res, next)).catch(next);
  };
}
