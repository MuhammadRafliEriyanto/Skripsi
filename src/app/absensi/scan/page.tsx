import StudentAttendanceScanPageClient from "@/components/absensi/StudentAttendanceScanPageClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    sessionId?: string | string[];
    token?: string | string[];
  };
};

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function StudentAttendanceScanPage({ searchParams }: PageProps) {
  return (
    <StudentAttendanceScanPageClient
      initialSessionId={firstSearchParam(searchParams?.sessionId)}
      initialToken={firstSearchParam(searchParams?.token)}
    />
  );
}
