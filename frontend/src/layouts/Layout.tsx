import { NavLink, Outlet } from "react-router";

export function Layout() {
  async function handleGetText() {
    const API_URL = import.meta.env.VITE_API_URL;

    const response = await fetch(`${API_URL}`);
    const responseJson = await response.json();

    const now = new Date();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
    const timeString = `${minutes}:${seconds}.${milliseconds}`;

    console.log(
      `%c${timeString} ${JSON.stringify(responseJson)}`,
      "font-size: 1rem; color: coral;",
    );
  }

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

      <button onClick={handleGetText} className="rounded p-2 outline">
        console log response
      </button>

      <Outlet />
    </div>
  );
}
