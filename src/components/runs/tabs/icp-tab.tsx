"use client";

import { useState, useTransition } from "react";

import {
  approveEditedIcp,
  approveIcp,
  regenerateIcp,
} from "@/app/actions/runs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { icpCriteriaSchema, type IcpCriteriaInput } from "@/domain/icp/icp";
import type {
  IcpCriteria,
  RunIcpRow,
  RunRow,
} from "@/infrastructure/supabase/types";

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function join(items?: string[]): string {
  return (items ?? []).join("\n");
}

function CriteriaList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ListField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder="One item per line"
      />
    </div>
  );
}

function criteriaFromFields(fields: {
  geographyInclude: string;
  geographyExclude: string;
  industryInclude: string;
  industryExclude: string;
  employeeMin: string;
  employeeMax: string;
  businessModel: string;
  personas: string;
  hardFilters: string;
  softSignals: string;
}): { criteria?: IcpCriteriaInput; error?: string } {
  const min = fields.employeeMin.trim();
  const max = fields.employeeMax.trim();
  const employeeMin = min === "" ? undefined : Number(min);
  const employeeMax = max === "" ? undefined : Number(max);
  if (
    (min !== "" && !Number.isInteger(employeeMin)) ||
    (max !== "" && !Number.isInteger(employeeMax))
  ) {
    return { error: "Employee range must be a whole number." };
  }
  if (
    typeof employeeMin === "number" &&
    typeof employeeMax === "number" &&
    employeeMin > employeeMax
  ) {
    return { error: "Employee minimum cannot be greater than the maximum." };
  }

  const draft: IcpCriteriaInput = {
    hard_filters: lines(fields.hardFilters),
    soft_signals: lines(fields.softSignals),
  };
  const geographyInclude = lines(fields.geographyInclude);
  const geographyExclude = lines(fields.geographyExclude);
  if (geographyInclude.length > 0 || geographyExclude.length > 0) {
    draft.geography = {
      include: geographyInclude.length > 0 ? geographyInclude : undefined,
      exclude: geographyExclude.length > 0 ? geographyExclude : undefined,
    };
  }
  const industryInclude = lines(fields.industryInclude);
  const industryExclude = lines(fields.industryExclude);
  if (industryInclude.length > 0 || industryExclude.length > 0) {
    draft.industry = {
      include: industryInclude.length > 0 ? industryInclude : undefined,
      exclude: industryExclude.length > 0 ? industryExclude : undefined,
    };
  }
  if (employeeMin !== undefined || employeeMax !== undefined) {
    draft.employee_range = { min: employeeMin, max: employeeMax };
  }
  const businessModel = lines(fields.businessModel);
  if (businessModel.length > 0) {
    draft.business_model = { include: businessModel };
  }
  const personas = lines(fields.personas);
  if (personas.length > 0) {
    draft.target_personas = personas;
  }

  const parsed = icpCriteriaSchema.safeParse(draft);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Criteria are not valid.",
    };
  }
  return { criteria: parsed.data };
}

export function IcpTab({
  run,
  icpVersions,
  approvedIcp,
}: {
  run: RunRow;
  icpVersions: RunIcpRow[];
  approvedIcp: RunIcpRow | null;
}) {
  const latest = icpVersions.at(-1) ?? null;
  const displayed = approvedIcp ?? latest;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(() =>
    fieldsFromCriteria(displayed?.criteria),
  );

  const canApprove =
    run.status === "awaiting_icp_approval" && latest && !latest.approved;

  if (!displayed) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          {run.status === "awaiting_icp_approval" || run.status === "draft"
            ? "Analyzing the qualification objective and identifying geography, company size, industry, and qualification signals…"
            : "No ICP has been generated for this run."}
        </CardContent>
      </Card>
    );
  }

  const c = displayed.criteria;

  function openApprove() {
    setError(null);
    setConfirming(true);
  }

  function openSave() {
    if (!latest) return;
    const parsed = criteriaFromFields(fields);
    if (!parsed.criteria) {
      setError(parsed.error ?? "Criteria are not valid.");
      return;
    }
    setError(null);
    setConfirming(true);
  }

  function confirmStart() {
    if (!latest) return;
    if (editing) {
      const parsed = criteriaFromFields(fields);
      if (!parsed.criteria) {
        setError(parsed.error ?? "Criteria are not valid.");
        setConfirming(false);
        return;
      }
      startTransition(async () => {
        await approveEditedIcp(run.id, latest.id, parsed.criteria!);
        setEditing(false);
        setConfirming(false);
      });
      return;
    }
    startTransition(async () => {
      await approveIcp(run.id, latest.id);
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Original objective</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            &ldquo;{run.objective}&rdquo;
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Refined ICP{" "}
            {approvedIcp ? (
              <Badge variant="success" className="ml-2">
                Approved
              </Badge>
            ) : (
              <Badge variant="warning" className="ml-2">
                Awaiting approval
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="grid gap-4">
              <ListField
                id="geography-include"
                label="Geography to include"
                value={fields.geographyInclude}
                onChange={(value) =>
                  setFields((current) => ({
                    ...current,
                    geographyInclude: value,
                  }))
                }
              />
              <ListField
                id="geography-exclude"
                label="Geography to exclude"
                value={fields.geographyExclude}
                onChange={(value) =>
                  setFields((current) => ({
                    ...current,
                    geographyExclude: value,
                  }))
                }
              />
              <ListField
                id="industry-include"
                label="Industry to include"
                value={fields.industryInclude}
                onChange={(value) =>
                  setFields((current) => ({
                    ...current,
                    industryInclude: value,
                  }))
                }
              />
              <ListField
                id="industry-exclude"
                label="Industry to exclude"
                value={fields.industryExclude}
                onChange={(value) =>
                  setFields((current) => ({
                    ...current,
                    industryExclude: value,
                  }))
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="employee-min">Minimum employees</Label>
                  <Input
                    id="employee-min"
                    inputMode="numeric"
                    value={fields.employeeMin}
                    onChange={(event) =>
                      setFields((current) => ({
                        ...current,
                        employeeMin: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-max">Maximum employees</Label>
                  <Input
                    id="employee-max"
                    inputMode="numeric"
                    value={fields.employeeMax}
                    onChange={(event) =>
                      setFields((current) => ({
                        ...current,
                        employeeMax: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <ListField
                id="business-model"
                label="Business model"
                value={fields.businessModel}
                onChange={(value) =>
                  setFields((current) => ({ ...current, businessModel: value }))
                }
              />
              <ListField
                id="personas"
                label="Target personas"
                value={fields.personas}
                onChange={(value) =>
                  setFields((current) => ({ ...current, personas: value }))
                }
              />
              <ListField
                id="hard-filters"
                label="Hard filters (must match)"
                value={fields.hardFilters}
                onChange={(value) =>
                  setFields((current) => ({ ...current, hardFilters: value }))
                }
              />
              <ListField
                id="soft-signals"
                label="Soft signals (evidence of fit)"
                value={fields.softSignals}
                onChange={(value) =>
                  setFields((current) => ({ ...current, softSignals: value }))
                }
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
          ) : (
            <>
              <CriteriaList title="Geography" items={c.geography?.include} />
              <CriteriaList
                title="Geography excluded"
                items={c.geography?.exclude}
              />
              <CriteriaList title="Industry" items={c.industry?.include} />
              <CriteriaList
                title="Industry excluded"
                items={c.industry?.exclude}
              />
              {c.employee_range && (
                <p className="text-sm">
                  <span className="font-medium">Employee range:</span>{" "}
                  {c.employee_range.min ?? "?"}
                  {"–"}
                  {c.employee_range.max ?? "?"}
                </p>
              )}
              <CriteriaList
                title="Business model"
                items={c.business_model?.include}
              />
              <CriteriaList title="Target personas" items={c.target_personas} />
              <CriteriaList
                title="Hard filters (must match)"
                items={c.hard_filters}
              />
              <CriteriaList
                title="Soft signals (evidence of fit)"
                items={c.soft_signals}
              />
              {displayed.reasoning && (
                <p className="text-muted-foreground border-t pt-3 text-sm">
                  {displayed.reasoning}
                </p>
              )}
            </>
          )}

          {canApprove && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {editing ? (
                <>
                  <Button onClick={openSave} disabled={pending}>
                    Save &amp; Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setError(null);
                    }}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={openApprove} disabled={pending}>
                    Approve &amp; Start Search
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFields(fieldsFromCriteria(displayed.criteria));
                      setError(null);
                      setEditing(true);
                    }}
                    disabled={pending}
                  >
                    Edit Criteria
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startTransition(() => regenerateIcp(run.id))}
                    disabled={pending}
                  >
                    Regenerate
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start research?</DialogTitle>
            <DialogDescription>
              Target qualified leads: {run.qualified_target}. Maximum companies
              to discover: {run.discovery_limit}. Once started, the agent will
              use the configured research tools within these limits. These
              limits cannot be raised.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={confirmStart} disabled={pending}>
              Start research
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fieldsFromCriteria(criteria: IcpCriteria | undefined) {
  return {
    geographyInclude: join(criteria?.geography?.include),
    geographyExclude: join(criteria?.geography?.exclude),
    industryInclude: join(criteria?.industry?.include),
    industryExclude: join(criteria?.industry?.exclude),
    employeeMin:
      criteria?.employee_range?.min !== undefined
        ? String(criteria.employee_range.min)
        : "",
    employeeMax:
      criteria?.employee_range?.max !== undefined
        ? String(criteria.employee_range.max)
        : "",
    businessModel: join(criteria?.business_model?.include),
    personas: join(criteria?.target_personas),
    hardFilters: join(criteria?.hard_filters),
    softSignals: join(criteria?.soft_signals),
  };
}
