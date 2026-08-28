import { TopNavBar } from "@/components/ui/TopNavBar";
export default function AppLayout({ children }: { children: React.ReactNode }) { return <><TopNavBar/><main className="min-h-screen pt-18">{children}</main></>; }
