import { Layout } from "@/layouts/Layout";
import { DrawingPage } from "@/pages/DrawingPage";
import { Gallery } from "@/pages/Gallery";
import { BrowserRouter, Route, Routes } from "react-router";

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DrawingPage />} />
          <Route path="gallery" element={<Gallery />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
