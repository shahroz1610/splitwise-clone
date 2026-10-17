-- Log the activity entry inside save_expense so a save needs one database call instead of two.
drop function if exists save_expense(uuid, text, bigint, uuid, text, text, date, text, jsonb);

create or replace function save_expense(
  p_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_category text,
  p_split_type text,
  p_expense_date date,
  p_notes text,
  p_splits jsonb,
  p_activity_kind text default null,
  p_activity_message text default null,
  p_actor_name text default null,
  p_activity_amount_cents bigint default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_total bigint;
begin
  if p_id is null then
    insert into expenses (description, amount_cents, paid_by, category, split_type, expense_date, notes)
    values (p_description, p_amount_cents, p_paid_by, p_category, p_split_type, p_expense_date, p_notes)
    returning id into v_id;
  else
    update expenses
       set description = p_description,
           amount_cents = p_amount_cents,
           paid_by = p_paid_by,
           category = p_category,
           split_type = p_split_type,
           expense_date = p_expense_date,
           notes = p_notes,
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Expense % not found', p_id;
    end if;
    delete from expense_splits where expense_id = v_id;
  end if;

  insert into expense_splits (expense_id, member_id, share_cents, input_value)
  select v_id,
         (s ->> 'member_id')::uuid,
         (s ->> 'share_cents')::bigint,
         nullif(s ->> 'input_value', '')::numeric
    from jsonb_array_elements(p_splits) as s;

  select coalesce(sum(share_cents), 0) into v_total from expense_splits where expense_id = v_id;
  if v_total <> p_amount_cents then
    raise exception 'Splits (%) do not add up to the total (%)', v_total, p_amount_cents;
  end if;

  if p_activity_kind is not null then
    insert into activity (kind, message, actor_name, amount_cents)
    values (p_activity_kind, p_activity_message, p_actor_name, p_activity_amount_cents);
  end if;

  return v_id;
end;
$$;

revoke execute on function save_expense(uuid, text, bigint, uuid, text, text, date, text, jsonb, text, text, text, bigint) from public, anon, authenticated;
