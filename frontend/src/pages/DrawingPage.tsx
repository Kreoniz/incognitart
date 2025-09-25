import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Toaster, toast } from "react-hot-toast";

export function DrawingPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pixelAmount, setPixelAmount] = useState(15);
  const [gridEnabled, setGridEnabled] = useState(true);
  const pixelColorRef = useRef("#000000");

  useEffect(() => {
    let pixelSize: number;
    const gridColor = "black";

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resizeCanvas() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pixelSize = Math.floor(rect.width / pixelAmount);
      canvas.width = rect.width - (rect.width % pixelSize);
      canvas.height = rect.height - (rect.height % pixelSize);

      if (gridEnabled) {
        drawGrid();
      }
    }

    resizeCanvas();

    function drawGrid() {
      if (!(canvas && ctx)) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = gridColor;

      for (let y = 0; y <= h; y += pixelSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (let x = 0; x <= w; x += pixelSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }

    function drawPixel(gridX: number, gridY: number, color: string) {
      if (!ctx) return;
      ctx.fillStyle = color;
      ctx.fillRect(gridX * pixelSize, gridY * pixelSize, pixelSize, pixelSize);
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvas);

    let drawing = false;

    function start(e: PointerEvent) {
      drawing = true;
      draw(e);
    }

    function draw(e: PointerEvent) {
      if (!(canvas && drawing)) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const gridX = Math.floor(mouseX / pixelSize);
      const gridY = Math.floor(mouseY / pixelSize);

      drawPixel(gridX, gridY, pixelColorRef.current);
    }

    function stop() {
      drawing = false;
    }

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointerleave", stop);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", draw);
      canvas.removeEventListener("pointerup", stop);
      canvas.removeEventListener("pointerleave", stop);
    };
  }, [pixelAmount, gridEnabled]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const formData = new FormData(e.currentTarget);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      formData.append("image", blob, "image.png");

      const API_URL = import.meta.env.VITE_API_URL;

      const res = await fetch(`${API_URL}/image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();
        toast.error(`Upload failed: ${msg}`);
        return;
      }

      toast.success("Image saved!");
    }, "image/png");
  }

  return (
    <div>
      <div className="flex flex-col-reverse justify-center gap-4 sm:flex-row">
        <canvas
          className="aspect-square w-full max-w-[600px] min-w-[300px] border-2"
          ref={canvasRef}
        ></canvas>

        <div>
          <div className="mb-4 flex items-start gap-4 sm:flex-col">
            <div className="flex items-center gap-2">
              <span>Color:</span>
              <input
                type="color"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  pixelColorRef.current = e.target.value;
                }}
              />
            </div>

            <div className="flex w-full flex-col items-start">
              <span>
                {pixelAmount}x{pixelAmount} pixels
              </span>
              <input
                className="w-full"
                min={10}
                max={50}
                value={pixelAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setPixelAmount(Number(e.target.value))
                }
                type="range"
              />
            </div>

            <div>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <span>Grid</span>
                <input
                  type="checkbox"
                  checked={gridEnabled}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setGridEnabled(e.target.checked);
                  }}
                  className="peer sr-only"
                />
                <div className="peer relative h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:bg-blue-600 dark:peer-focus:ring-blue-800"></div>
              </label>
            </div>
          </div>

          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <label className="flex flex-col" htmlFor="authorName">
              <span>Author name:</span>
              <input
                className="rounded border px-1"
                id="authorName"
                name="authorName"
                type="text"
              />
            </label>

            <label className="flex flex-col" htmlFor="imageName">
              <span>Image name:</span>
              <input
                className="rounded border px-1"
                id="imageName"
                name="imageName"
                type="text"
              />
            </label>

            <button
              className="rounded border p-2 text-center hover:cursor-pointer hover:bg-black/10 active:bg-black/20"
              type="submit"
            >
              Publish image
            </button>
          </form>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
