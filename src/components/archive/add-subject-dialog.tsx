"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { createSubject } from "@/actions/subjects";

interface AddSubjectDialogProps {
  variant?: "default" | "outline";
  className?: string;
  buttonText?: string;
}

const COLORS = [
  { name: "Default Explorer Color", value: "#F4C542" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Green", value: "#22c55e" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Cyan", value: "#06b6d4" },
];

export function AddSubjectDialog({ variant = "default", className, buttonText = "Add Subject" }: AddSubjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Subject name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createSubject(name.trim(), code.trim(), color);
      setOpen(false);
      setName("");
      setCode("");
      setColor(COLORS[0].value);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create subject.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} className={className} />}>
        <Plus className="mr-1.5 h-4 w-4" /> {buttonText}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Subject</DialogTitle>
          <DialogDescription>
            Create a new subject portal to organize your study materials and folders.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">Subject Name</label>
            <Input 
              placeholder="e.g. Data Structures" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              disabled={loading}
              maxLength={50}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">Course Code (Optional)</label>
            <Input 
              placeholder="e.g. CS201" 
              value={code} 
              onChange={(e) => setCode(e.target.value)} 
              disabled={loading}
              maxLength={15}
            />
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <label className="text-sm font-semibold text-foreground">Theme Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full ${color === c.value ? 'ring-2 ring-offset-2 ring-foreground' : 'ring-1 ring-border/20 opacity-80 hover:opacity-100'} transition-all`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="min-w-[100px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Subject"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
