-- Operator notes: a free-text scratchpad on a lead for human reviewers.
-- The agent never reads or writes this column.

alter table leads
  add column operator_note text;
