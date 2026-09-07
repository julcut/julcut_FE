import { redirect } from "next/navigation";

/**
 * 축제 목록은 콘솔 홈이 이미 진행예정/진행중/진행완료로 나눠 보여준다.
 * 이 주소는 미완성 화면이 노출되지 않도록 홈으로 넘긴다.
 */
export default function FestivalListPage() {
  redirect("/console");
}
