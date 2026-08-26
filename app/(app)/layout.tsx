import { SideNavBar } from "@/components/ui/SideNavBar";
import { TopNavBar } from "@/components/ui/TopNavBar";
export default function AppLayout({ children }: { children: React.ReactNode }) { return <><TopNavBar/><SideNavBar/><main className="min-h-screen pt-16 lg:pl-60">{children}</main></>; }
