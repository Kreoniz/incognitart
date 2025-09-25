import { PenTool } from "lucide-react";
import { NavLink, Outlet } from "react-router";

export function Layout() {
  return (
    <div className="m-auto min-h-screen max-w-5xl px-2">
      <header className="flex flex-col items-center gap-2 py-4 sm:flex-row sm:justify-between">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-2xl font-bold hover:underline"
        >
          <PenTool />
          Incognitart
        </NavLink>

        <nav className="flex items-center gap-2 text-lg font-bold">
          <NavLink to="/" className="hover:underline">
            Drawing Page
          </NavLink>
          |
          <NavLink to="/gallery" className="hover:underline">
            Gallery
          </NavLink>
        </nav>
      </header>

      <Outlet />
    </div>
  );
}
