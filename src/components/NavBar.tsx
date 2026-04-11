"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, LayoutDashboard, CalendarDays, Settings, CreditCard, Wallet } from "lucide-react";

const links = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tomorrow", label: "Schedule", icon: CalendarDays },
  { href: "/bookings", label: "Bookings", icon: BookOpen },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden sm:block bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex items-center gap-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="sm:hidden bg-white border-b border-gray-200 sticky top-0 z-50 px-4 h-3" />

      {/* Mobile bottom nav */}
      <nav className="sm:hidden bottom-nav">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`bottom-nav-item ${pathname === href ? "active" : ""}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
