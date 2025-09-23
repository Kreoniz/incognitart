import { NavLink, Outlet } from "react-router";

export function Layout() {
  return (
    <div>
      <nav className="flex gap-2">
        <NavLink to="/" className="hover:underline">
          Drawing Page
        </NavLink>
        |
        <NavLink to="/gallery" className="hover:underline">
          Gallery
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
