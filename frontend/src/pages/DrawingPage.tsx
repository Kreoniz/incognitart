import { useEffect, useRef, useState, type ChangeEvent } from "react";

export function DrawingPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pixelAmount, setPixelAmount] = useState(10);
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

  return (
    <div>
      <h1 className="my-2 text-2xl font-bold">Drawing Page</h1>

      <div className="flex flex-col-reverse justify-center gap-4 sm:flex-row">
        <canvas
          className="aspect-square w-full max-w-[600px] min-w-[300px] border-2"
          ref={canvasRef}
        ></canvas>

        <div className="flex items-center gap-4 sm:flex-col">
          <div>
            <input
              type="color"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                pixelColorRef.current = e.target.value;
              }}
            />
          </div>

          <div className="flex flex-col items-center">
            <span>
              {pixelAmount}x{pixelAmount} pixels
            </span>
            <input
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
              <span className="text-sm">Grid</span>
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
      </div>
    </div>
  );
}
