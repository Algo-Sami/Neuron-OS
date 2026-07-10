import React from "react";
import { Card, CardContent } from "@/components/ui/card";

// Premium custom toggle switch
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, id, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary ${
        checked ? "bg-primary" : "bg-muted/80 border-border/80"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-foreground shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4 bg-primary-foreground" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Uniform Settings Row
interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 gap-6">
      <div className="space-y-0.5 text-left">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        {description && (
          <p className="text-[10px] text-muted-foreground leading-normal max-w-lg">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Clean Card Section Container
interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  icon,
  children,
  headerAction,
}: SectionCardProps) {
  return (
    <Card className="glass-panel border-border/60 rounded-2xl overflow-hidden bg-card/25 shadow-xs mb-5">
      <div className="p-4 border-b border-border/40 flex justify-between items-center">
        <div className="flex items-center gap-2 text-left">
          {icon && <div className="text-primary">{icon}</div>}
          <div>
            <h3 className="text-xs font-bold text-foreground">{title}</h3>
            {description && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <CardContent className="p-4 space-y-1">{children}</CardContent>
    </Card>
  );
}
