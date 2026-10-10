"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";

type Dimensions = { width: number; height: number };
type Pan = { x: number; y: number };

type AvatarCropperProps = {
  src: string;
  onCancel: () => void;
  onApply: (croppedImage: string) => void;
  onError: (message: string) => void;
};

const outputSize = 512;

export function AvatarCropper({ src, onCancel, onApply, onError }: AvatarCropperProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const onErrorRef = useRef(onError);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; pan: Pan } | null>(null);
  const [size, setSize] = useState(280);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });

  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      imageRef.current = image;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => onErrorRef.current("That image could not be loaded. Try another photo.");
    image.src = src;

    return () => {
      image.onload = null;
      image.onerror = null;
      imageRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize(entry.contentRect.width);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function trapFocus(event:KeyboardEvent){
      if(event.key!=="Tab")return;
      const controls=[...dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,[tabindex="0"]')??[]];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener("keydown",trapFocus);
    return()=>{document.removeEventListener("keydown",trapFocus);previous?.focus();};
  },[]);

  const imageLayout = useMemo(() => {
    if (!dimensions) return null;
    const scale = (size / Math.min(dimensions.width, dimensions.height)) * zoom;
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    const maxPanX = Math.max(0, (width - size) / 2);
    const maxPanY = Math.max(0, (height - size) / 2);
    return {
      scale,
      width,
      height,
      maxPanX,
      maxPanY,
      left: (size - width) / 2 + Math.max(-maxPanX, Math.min(maxPanX, pan.x)),
      top: (size - height) / 2 + Math.max(-maxPanY, Math.min(maxPanY, pan.y)),
    };
  }, [dimensions, pan, size, zoom]);

  function updatePan(x: number, y: number) {
    const maxPanX = imageLayout?.maxPanX ?? 0;
    const maxPanY = imageLayout?.maxPanY ?? 0;
    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y)),
    });
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!imageLayout) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updatePan(drag.pan.x + event.clientX - drag.x, drag.pan.y + event.clientY - drag.y);
  }

  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function applyCrop() {
    const image = imageRef.current;
    if (!image || !dimensions || !imageLayout) return;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) {
      onError("Your browser cannot crop that image. Try another photo.");
      return;
    }

    const sourceSize = size / imageLayout.scale;
    const sourceX = -imageLayout.left / imageLayout.scale;
    const sourceY = -imageLayout.top / imageLayout.scale;
    try {
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
      onApply(canvas.toDataURL("image/jpeg", 0.84));
    } catch {
      onError("Could not crop that image. Try another photo.");
    }
  }

  return (
    <div className="avatar-crop-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
        <header className="avatar-crop-header">
          <div><p className="social-kicker">PROFILE PHOTO</p><h2 id="avatar-crop-title">Crop your photo</h2></div>
          <button type="button" className="avatar-crop-close" onClick={onCancel} aria-label="Cancel photo crop"><X size={19}/></button>
        </header>
        <p className="avatar-crop-help">Drag to position your photo, then use the slider to zoom.</p>
        <div
          className={`avatar-crop-viewport${imageLayout ? " is-ready" : ""}`}
          ref={viewportRef}
          tabIndex={0}
          onKeyDown={event=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();const delta=event.shiftKey?20:5;updatePan(pan.x+(event.key==="ArrowLeft"?-delta:event.key==="ArrowRight"?delta:0),pan.y+(event.key==="ArrowUp"?-delta:event.key==="ArrowDown"?delta:0));}}}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onWheel={(event) => setZoom((value) => Math.max(1, Math.min(3, value + (event.deltaY < 0 ? 0.08 : -0.08))))}
          role="group"
          aria-label="Photo crop area. Drag the image to adjust its position."
        >
          {imageLayout && dimensions ? <Image
            className="avatar-crop-image"
            src={src}
            alt="Photo being cropped"
            width={dimensions.width}
            height={dimensions.height}
            unoptimized
            draggable={false}
            style={{ width: imageLayout.width, height: imageLayout.height, transform: `translate(${imageLayout.left}px, ${imageLayout.top}px)` }}
          /> : <span className="avatar-crop-loading">Preparing photo…</span>}
        </div>
        <label className="avatar-crop-zoom">Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom photo"/><span>{zoom.toFixed(1)}×</span></label>
        <footer className="avatar-crop-actions">
          <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="action-button" onClick={applyCrop} disabled={!imageLayout}>Use photo <Check size={16}/></button>
        </footer>
      </section>
    </div>
  );
}
