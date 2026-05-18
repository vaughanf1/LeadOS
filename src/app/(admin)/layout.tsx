import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
