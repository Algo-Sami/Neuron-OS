"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Trash2, 
  Square, 
  Circle, 
  PenTool, 
  Eraser, 
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveWhiteboardDataAction } from "@/actions/study-rooms";
import { createClient } from "@/lib/supabase/client";

export interface Shape {
  id: string;
  type: "pen" | "rect" | "circle";
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[]; // For pen tool
  x?: number; // For rect/circle
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
}

interface WhiteboardCanvasProps {
  roomId: string;
  initialData: Shape[];
  onSync: (shapes: Shape[]) => void;
}

export function WhiteboardCanvas({
  roomId,
  initialData,
  onSync
}: WhiteboardCanvasProps) {
  const supabase = createClient();
  const [shapes, setShapes] = useState<Shape[]>(initialData || []);
  const [tool, setTool] = useState<"pen" | "rect" | "circle" | "eraser">("pen");
  const [color, setColor] = useState<string>("#6366f1"); // Indigo primary
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Load database synced changes
  useEffect(() => {
    // Listen for realtime whiteboard drawing events broadcasted by peers
    const channel = supabase.channel(`whiteboard_${roomId}`);
    channel
      .on("broadcast", { event: "whiteboard_draw" }, (payload: { payload?: { shapes?: Shape[] } }) => {
        if (payload.payload?.shapes) {
          setShapes(payload.payload.shapes);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  const getCoordinates = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);

    const newShape: Shape = {
      id: Math.random().toString(36).substring(7),
      type: tool === "eraser" ? "pen" : tool,
      color: tool === "eraser" ? "#ffffff" : color,
      strokeWidth: tool === "eraser" ? 20 : tool === "pen" ? 4 : 2,
      points: tool === "pen" || tool === "eraser" ? [coords] : undefined,
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0,
      radius: 0
    };

    setCurrentShape(newShape);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !currentShape) return;
    const coords = getCoordinates(e);

    if (tool === "pen" || tool === "eraser") {
      const updatedPoints = [...(currentShape.points || []), coords];
      setCurrentShape({
        ...currentShape,
        points: updatedPoints
      });
    } else if (tool === "rect") {
      const startX = currentShape.x || 0;
      const startY = currentShape.y || 0;
      setCurrentShape({
        ...currentShape,
        width: Math.abs(coords.x - startX),
        height: Math.abs(coords.y - startY),
        x: Math.min(coords.x, startX),
        y: Math.min(coords.y, startY)
      });
    } else if (tool === "circle") {
      const startX = currentShape.x || 0;
      const startY = currentShape.y || 0;
      const r = Math.sqrt(Math.pow(coords.x - startX, 2) + Math.pow(coords.y - startY, 2));
      setCurrentShape({
        ...currentShape,
        radius: r
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentShape) return;
    setIsDrawing(false);

    const nextShapes = [...shapes, currentShape];
    setShapes(nextShapes);
    setCurrentShape(null);

    // Sync broadcast to all active room members
    onSync(nextShapes);
    
    // Broadcast via supabase channel
    const channel = supabase.channel(`whiteboard_${roomId}`);
    channel.send({
      type: "broadcast",
      event: "whiteboard_draw",
      payload: { shapes: nextShapes }
    });
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the collaborative whiteboard?")) {
      setShapes([]);
      onSync([]);
      
      const channel = supabase.channel(`whiteboard_${roomId}`);
      channel.send({
        type: "broadcast",
        event: "whiteboard_draw",
        payload: { shapes: [] }
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveWhiteboardDataAction(roomId, shapes);
      if (res.success) {
        alert("Whiteboard saved successfully in room notes!");
      }
    } catch {
      // no-op
    }
    setSaving(false);
  };

  const colors = [
    { value: "#6366f1", label: "Indigo" },
    { value: "#10b981", label: "Emerald" },
    { value: "#ef4444", label: "Red" },
    { value: "#f97316", label: "Orange" },
    { value: "#000000", label: "Black" }
  ];

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 justify-between">
      
      {/* Tool bar & colors */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 pb-3">
        
        {/* Tool picker */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/20">
          <Button
            onClick={() => setTool("pen")}
            variant={tool === "pen" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-lg cursor-pointer"
          >
            <PenTool className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setTool("rect")}
            variant={tool === "rect" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-lg cursor-pointer"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setTool("circle")}
            variant={tool === "circle" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-lg cursor-pointer"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setTool("eraser")}
            variant={tool === "eraser" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-lg cursor-pointer"
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </div>

        {/* Color Palette */}
        {tool !== "eraser" && (
          <div className="flex items-center gap-1.5 bg-muted/20 px-2 py-1 rounded-xl border border-border/20">
            {colors.map(c => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`h-5 w-5 rounded-full border border-border/40 transition-transform ${
                  color === c.value ? "scale-125 border-primary shadow-sm" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            size="sm"
            className="rounded-xl flex gap-1 items-center font-bold cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            Save Notes
          </Button>
          
          <Button
            onClick={handleClear}
            variant="destructive"
            size="icon-sm"
            className="rounded-xl cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

      </div>

      {/* SVG Canvas Board */}
      <div className="flex-1 bg-white dark:bg-card border border-border/30 rounded-2xl overflow-hidden relative shadow-inner h-[280px]">
        <svg
          ref={svgRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full select-none cursor-crosshair"
        >
          {/* Render already saved shapes */}
          {shapes.map((s) => {
            if (s.type === "pen" && s.points) {
              const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              return (
                <path
                  key={s.id}
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            } else if (s.type === "rect") {
              return (
                <rect
                  key={s.id}
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                />
              );
            } else if (s.type === "circle") {
              return (
                <circle
                  key={s.id}
                  cx={s.x}
                  cy={s.y}
                  r={s.radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                />
              );
            }
            return null;
          })}

          {/* Render current active shape while drawing */}
          {currentShape && (
            <>
              {currentShape.type === "pen" && currentShape.points && (
                <path
                  d={currentShape.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                  fill="none"
                  stroke={currentShape.color}
                  strokeWidth={currentShape.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {currentShape.type === "rect" && (
                <rect
                  x={currentShape.x}
                  y={currentShape.y}
                  width={currentShape.width}
                  height={currentShape.height}
                  fill="none"
                  stroke={currentShape.color}
                  strokeWidth={currentShape.strokeWidth}
                />
              )}
              {currentShape.type === "circle" && (
                <circle
                  cx={currentShape.x}
                  cy={currentShape.y}
                  r={currentShape.radius}
                  fill="none"
                  stroke={currentShape.color}
                  strokeWidth={currentShape.strokeWidth}
                />
              )}
            </>
          )}
        </svg>

        <span className="absolute bottom-2 right-2 text-[9px] bg-black/60 text-white px-2 py-0.5 rounded-lg font-bold select-none">
          Cooperative SVG Drawing Board
        </span>
      </div>

    </div>
  );
}
