import Link from "next/link";

/** 없는 주소로 들어왔을 때 빈 화면 대신 돌아갈 길을 보여준다. */
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <h1 className="heading-small text-zinc-950">페이지를 찾을 수 없습니다</h1>
      <p className="body-small text-center text-zinc-500">주소가 바뀌었거나 삭제된 화면입니다.</p>
      <Link href="/console" className="body-small-bold text-primary underline underline-offset-4">
        축제 목록으로 돌아가기
      </Link>
    </main>
  );
}
