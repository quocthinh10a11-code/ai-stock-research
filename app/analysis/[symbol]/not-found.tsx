import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { TopNavBar } from "@/components/ui/TopNavBar";

export default function AnalysisNotFound() {
  return <><TopNavBar/><main className="grid min-h-screen place-items-center bg-canvas px-5 py-28"><section className="panel w-full max-w-xl p-8 text-center"><SearchX className="mx-auto text-slate-400" size={32}/><h1 className="mt-5 text-2xl font-bold text-navy">Không tìm thấy mã cổ phiếu</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">Mã này chưa có trong catalog HOSE, HNX hoặc UPCOM đã đồng bộ. Kiểm tra lại ký hiệu hoặc chạy job cập nhật catalog.</p><Link href="/home" className="btn-primary mt-7"><ArrowLeft size={16}/>Về trang chủ</Link></section></main></>;
}
