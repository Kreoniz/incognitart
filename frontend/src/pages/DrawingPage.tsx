import { useEffect, useRef, useState, type ChangeEvent } from "react";

export function DrawingPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pixelAmount, setPixelAmount] = useState(10);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [pixelColor, setPixelColor] = useState("#000000");

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
      console.log(rect, canvas.width, canvas.height);
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

      drawPixel(gridX, gridY, pixelColor);
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
  }, [pixelAmount, gridEnabled, pixelColor]);

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
                setPixelColor(e.target.value);
              }}
            />
          </div>

          <div>
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
            <input
              type="checkbox"
              checked={gridEnabled}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setGridEnabled(e.target.checked);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
