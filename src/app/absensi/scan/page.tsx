import StudentAttendanceScanPageClient from "@/components/absensi/StudentAttendanceScanPageClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function StudentAttendanceScanPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  return (
    <StudentAttendanceScanPageClient
      initialSessionId={firstSearchParam(resolvedParams?.sessionId)}
      initialToken={firstSearchParam(resolvedParams?.token)}
    />
  );
}
