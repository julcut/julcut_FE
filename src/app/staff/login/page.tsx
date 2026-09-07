import { StaffLoginForm } from "./StaffLoginForm";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ festivalId?: string; expired?: string }>;
}) {
  const { festivalId, expired } = await searchParams;
  return <StaffLoginForm festivalId={festivalId} sessionExpired={expired === "1"} />;
}
