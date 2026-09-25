import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import Button from './ui/Button';

/** Finger/mouse signature capture that returns a PNG File. */
export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#241611';
  }, []);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    canvasRef.current.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(...point(e));
    ctx.stroke();
    setEmpty(false);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current.toBlob((blob) => blob && onChange(new File([blob], 'signature.png', { type: 'image/png' })), 'image/png');
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-stone-300 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        aria-label="Signature area"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-stone-500">{empty ? 'Customer signs above' : 'Signature captured'}</p>
        <Button size="sm" variant="ghost" icon={Eraser} onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
