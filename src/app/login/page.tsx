import { Header } from "@/components/layout/Header";
import { LoginForm } from "@/features/auth/admin/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <>
      <Header variant="default" />
      <main className="bg-dimmed flex flex-1 items-center justify-center p-8">
        <LoginForm sessionExpired={expired === "1"} />
      </main>
    </>
  );
}
