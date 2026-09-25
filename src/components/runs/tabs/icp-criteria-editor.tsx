import { ChipInput } from "@/components/ui/chip-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IcpCriteria } from "@/infrastructure/supabase/types";

function Section({
  id,
  label,
  values,
  onChange,
  readOnly,
  disabled,
  minItems,
  variant,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  readOnly: boolean;
  disabled: boolean;
  minItems?: number;
  variant?: "outline" | "secondary";
}) {
  if (readOnly && values.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <ChipInput
        id={id}
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        minItems={minItems}
        variant={variant}
        emptyHint={readOnly ? undefined : "None specified"}
        placeholder={`Add ${label.toLowerCase()}…`}
      />
    </div>
  );
}

export function IcpCriteriaEditor({
  criteria,
  onChange,
  readOnly,
  disabled = false,
}: {
  criteria: IcpCriteria;
  onChange: (next: IcpCriteria) => void;
  readOnly: boolean;
  disabled?: boolean;
}) {
  function set<K extends keyof IcpCriteria>(key: K, value: IcpCriteria[K]) {
    onChange({ ...criteria, [key]: value });
  }

  const min = criteria.employee_range?.min;
  const max = criteria.employee_range?.max;
  const showEmployeeRange = readOnly && (min !== undefined || max !== undefined);

  return (
    <div className="grid gap-4">
      <Section
        id="geography-include"
        label="Geography"
        values={criteria.geography?.include ?? []}
        onChange={(next) =>
          set("geography", { ...criteria.geography, include: next })
        }
        readOnly={readOnly}
        disabled={disabled}
      />
      <Section
        id="geography-exclude"
        label="Geography excluded"
        values={criteria.geography?.exclude ?? []}
        onChange={(next) =>
          set("geography", { ...criteria.geography, exclude: next })
        }
        readOnly={readOnly}
        disabled={disabled}
      />
      <Section
        id="industry-include"
        label="Industry"
        values={criteria.industry?.include ?? []}
        onChange={(next) =>
          set("industry", { ...criteria.industry, include: next })
        }
        readOnly={readOnly}
        disabled={disabled}
      />
      <Section
        id="industry-exclude"
        label="Industry excluded"
        values={criteria.industry?.exclude ?? []}
        onChange={(next) =>
          set("industry", { ...criteria.industry, exclude: next })
        }
        readOnly={readOnly}
        disabled={disabled}
      />

      {readOnly ? (
        showEmployeeRange && (
          <p className="text-sm">
            <span className="font-medium">Employee range:</span>{" "}
            {min ?? "?"}
            {"–"}
            {max ?? "?"}
          </p>
        )
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="employee-min">Minimum employees</Label>
            <Input
              id="employee-min"
              inputMode="numeric"
              disabled={disabled}
              value={min ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim();
                set("employee_range", {
                  ...criteria.employee_range,
                  min: value === "" ? undefined : Number(value),
                });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employee-max">Maximum employees</Label>
            <Input
              id="employee-max"
              inputMode="numeric"
              disabled={disabled}
              value={max ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim();
                set("employee_range", {
                  ...criteria.employee_range,
                  max: value === "" ? undefined : Number(value),
                });
              }}
            />
          </div>
        </div>
      )}

      <Section
        id="business-model"
        label="Business model"
        values={criteria.business_model?.include ?? []}
        onChange={(next) => set("business_model", { include: next })}
        readOnly={readOnly}
        disabled={disabled}
      />
      <Section
        id="personas"
        label="Target personas"
        values={criteria.target_personas ?? []}
        onChange={(next) => set("target_personas", next)}
        readOnly={readOnly}
        disabled={disabled}
      />
      <Section
        id="hard-filters"
        label="Hard filters (must match)"
        values={criteria.hard_filters ?? []}
        onChange={(next) => set("hard_filters", next)}
        readOnly={readOnly}
        disabled={disabled}
        minItems={1}
      />
      <Section
        id="soft-signals"
        label="Soft signals (evidence of fit)"
        values={criteria.soft_signals ?? []}
        onChange={(next) => set("soft_signals", next)}
        readOnly={readOnly}
        disabled={disabled}
      />
    </div>
  );
}
