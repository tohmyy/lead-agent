"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VariantProps } from "class-variance-authority";

export function ChipInput({
  id,
  values,
  onChange,
  placeholder = "Add…",
  emptyHint,
  minItems = 0,
  variant = "outline",
  readOnly = false,
  disabled = false,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
  minItems?: number;
  variant?: VariantProps<typeof badgeVariants>["variant"];
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || values.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  if (readOnly) {
    if (values.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant={variant}>
            {value}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => {
          const removeDisabled = disabled || values.length <= minItems;
          return (
            <Badge key={value} variant={variant} className="gap-1 pr-1">
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                title={
                  removeDisabled && values.length <= minItems
                    ? `At least ${minItems} ${minItems === 1 ? "item is" : "items are"} required`
                    : undefined
                }
                disabled={removeDisabled}
                onClick={() => remove(value)}
                className="hover:bg-foreground/10 disabled:pointer-events-none disabled:opacity-40 rounded-full"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          );
        })}
        {values.length === 0 && emptyHint && (
          <p className="text-muted-foreground text-sm italic">{emptyHint}</p>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className="h-7 max-w-xs text-sm"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={disabled || !draft.trim()}
          onClick={add}
          aria-label="Add"
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
