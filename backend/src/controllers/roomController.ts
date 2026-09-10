import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";
import "../types/express";

import { Room, ROOM_STATUSES } from "../models/Room";
import { toPublicRoom } from "../utils/adminView";
import asyncHandler from "../utils/asyncHandler";
import {
  assertBranchAccess,
  matchesBranchScope,
  resolveAdminBranchScope,
} from "../utils/adminBranchScope";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { getNextPublicId } from "../utils/publicId";

type RoomRequestBody = {
  name?: string;
  floor?: string;
  status?: string;
  activeClass?: string;
  teacher?: string;
  time?: string;
  occupancy?: number;
  capacityLabel?: string;
  nextSession?: string;
};

function normalizeText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function inferRoomBranch(roomId: string | undefined): string {
  const normalizedRoomId = normalizeText(roomId).toUpperCase();

  if (normalizedRoomId.includes("SLW")) {
    return "Slawi";
  }

  if (normalizedRoomId.includes("ADI")) {
    return "Adiwerna";
  }

  return "";
}

function getRoomIdPrefixForBranch(branch: string) {
  const normalizedBranch = normalizeText(branch).toLowerCase();

  if (normalizedBranch === "slawi") {
    return "RM-SLW";
  }

  if (normalizedBranch === "adiwerna") {
    return "RM-ADI";
  }

  return "";
}

function parseOccupancy(value: unknown): number | null {
  if (typeof value === "number" && value >= 0 && value <= 100) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value.trim());

    if (!Number.isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 100) {
      return parsedValue;
    }
  }

  return null;
}

async function findRoomByParam(id: string) {
  return Room.findOne({
    $or: [
      { roomId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  }).exec();
}

export const getRooms = asyncHandler(async (req: Request, res: Response) => {
  const scope = await resolveAdminBranchScope(req.user, {
    requireManagedBranchesForAdmin: true,
  });
  const rooms = await Room.find().sort({ createdAt: -1 }).exec();
  const scopedRooms = rooms.filter((room) =>
    matchesBranchScope(inferRoomBranch(room.roomId), scope),
  );

  sendSuccess(res, {
    data: {
      rooms: scopedRooms.map((room) => toPublicRoom(room)),
    },
  });
});

export const getRoomById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const room = await findRoomByParam(req.params.id);

    if (!room) {
      next(new AppError(404, "Data ruangan tidak ditemukan."));
      return;
    }

    assertBranchAccess(inferRoomBranch(room.roomId), scope);

    sendSuccess(res, {
      data: {
        room: toPublicRoom(room),
      },
    });
  },
);

export const createRoom = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, RoomRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const name = normalizeText(req.body.name);
    const floor = normalizeText(req.body.floor);
    const status = normalizeText(req.body.status) as RoomRequestBody["status"];
    const activeClass = normalizeText(req.body.activeClass);
    const teacher = normalizeText(req.body.teacher);
    const time = normalizeText(req.body.time);
    const occupancy = parseOccupancy(req.body.occupancy);
    const capacityLabel = normalizeText(req.body.capacityLabel);
    const nextSession = normalizeText(req.body.nextSession);

    if (!name || !floor || !activeClass || !teacher || !time || occupancy === null || !capacityLabel || !nextSession) {
      next(new AppError(400, "Data ruangan belum lengkap."));
      return;
    }

    if (!status || !ROOM_STATUSES.includes(status as (typeof ROOM_STATUSES)[number])) {
      next(new AppError(400, "Status ruangan belum valid."));
      return;
    }

    const managedBranch = scope.isScopedToManagedBranches
      ? scope.managedBranches[0] ?? ""
      : "";
    const roomIdPrefix = managedBranch
      ? getRoomIdPrefixForBranch(managedBranch)
      : "ROOM";

    if (scope.isScopedToManagedBranches && !roomIdPrefix) {
      next(new AppError(400, "Prefix ruangan untuk cabang admin belum tersedia."));
      return;
    }

    if (managedBranch) {
      assertBranchAccess(managedBranch, scope);
    }

    const roomId = await getNextPublicId(Room, "roomId", roomIdPrefix);
    const room = await Room.create({
      roomId,
      name,
      floor,
      status: status as (typeof ROOM_STATUSES)[number],
      activeClass,
      teacher,
      time,
      occupancy,
      capacityLabel,
      nextSession,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Data ruangan berhasil dibuat.",
      data: {
        room: toPublicRoom(room),
      },
    });
  },
);

export const updateRoom = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, RoomRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const room = await findRoomByParam(req.params.id);

    if (!room) {
      next(new AppError(404, "Data ruangan tidak ditemukan."));
      return;
    }

    assertBranchAccess(inferRoomBranch(room.roomId), scope);

    const name = normalizeText(req.body.name);
    const floor = normalizeText(req.body.floor);
    const status = normalizeText(req.body.status) as RoomRequestBody["status"];
    const activeClass = normalizeText(req.body.activeClass);
    const teacher = normalizeText(req.body.teacher);
    const time = normalizeText(req.body.time);
    const occupancy = parseOccupancy(req.body.occupancy);
    const capacityLabel = normalizeText(req.body.capacityLabel);
    const nextSession = normalizeText(req.body.nextSession);

    if (!name || !floor || !activeClass || !teacher || !time || occupancy === null || !capacityLabel || !nextSession) {
      next(new AppError(400, "Data ruangan belum lengkap."));
      return;
    }

    if (!status || !ROOM_STATUSES.includes(status as (typeof ROOM_STATUSES)[number])) {
      next(new AppError(400, "Status ruangan belum valid."));
      return;
    }

    room.name = name;
    room.floor = floor;
    room.status = status as (typeof ROOM_STATUSES)[number];
    room.activeClass = activeClass;
    room.teacher = teacher;
    room.time = time;
    room.occupancy = occupancy;
    room.capacityLabel = capacityLabel;
    room.nextSession = nextSession;
    await room.save();

    sendSuccess(res, {
      message: "Data ruangan berhasil diperbarui.",
      data: {
        room: toPublicRoom(room),
      },
    });
  },
);

export const deleteRoom = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const room = await findRoomByParam(req.params.id);

    if (!room) {
      next(new AppError(404, "Data ruangan tidak ditemukan."));
      return;
    }

    assertBranchAccess(inferRoomBranch(room.roomId), scope);

    await Room.deleteOne({ _id: room._id });

    sendSuccess(res, {
      message: "Data ruangan berhasil dihapus.",
    });
  },
);
