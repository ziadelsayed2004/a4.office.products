import { Alert, TextField } from '@mui/material';
import { Field } from './forms/Field.jsx';
import { FieldGrid } from './forms/FieldGrid.jsx';
import { money } from '../utils/formatters.js';
import { parsePiasters } from '../utils/money.js';
import './PaymentEntry.css';

function methodCode(method) {
  return method.code || method.method || method.id;
}

export function paymentRowsToPayload(methods, rows, due) {
  const payload = [];
  let total = 0;
  for (const method of methods) {
    const code = methodCode(method);
    const row = rows[code] || {};
    if (!String(row.amount || '').trim()) continue;
    const amount = parsePiasters(row.amount);
    if (amount <= 0) throw new Error('كل مبلغ دفع مستخدم يجب أن يكون أكبر من صفر.');
    const payment = {
      method: code,
      amount,
      referenceNumber: row.referenceNumber?.trim() || null,
      note: row.note?.trim() || null
    };
    if (method.accepts_cash_received) {
      payment.cashReceived = parsePiasters(row.cashReceived);
      if (payment.cashReceived < amount) throw new Error('المبلغ النقدي المستلم أقل من المبلغ المطبق.');
    }
    payload.push(payment);
    total += amount;
  }
  if (Number(due) === 0 && payload.length === 0) return [];
  if (total !== Number(due)) throw new Error(`إجمالي الدفعات ${money(total)} لا يساوي المطلوب ${money(due)}.`);
  return payload;
}

export function PaymentEntry({ methods, due, value, onChange }) {
  const set = (code, key, nextValue) => {
    onChange({ ...value, [code]: { ...value[code], [key]: nextValue } });
  };
  const preview = methods.reduce((result, method) => {
    const code = methodCode(method);
    const row = value[code] || {};
    try {
      const amount = row.amount ? parsePiasters(row.amount) : 0;
      const received = row.cashReceived ? parsePiasters(row.cashReceived) : 0;
      result.applied += amount;
      if (method.accepts_cash_received && received >= amount) result.change += received - amount;
    } catch {
      result.invalid = true;
    }
    return result;
  }, { applied: 0, change: 0, invalid: false });

  return (
    <div className="payment-entry">
      <Alert severity={preview.applied === due && !preview.invalid ? 'success' : 'info'}>
        المطلوب {money(due)} · المطبق {money(preview.applied)}
        {preview.change > 0 ? ` · الباقي للعميل ${money(preview.change)}` : ''}
      </Alert>
      <div className="payment-entry__methods">
        {methods.map((method) => {
          const code = methodCode(method);
          const row = value[code] || {};
          return (
            <section className="payment-entry__method" key={code}>
              <strong>{method.name_ar || method.name || code}</strong>
              <FieldGrid>
                <Field label="المبلغ المطبق" ltr><TextField value={row.amount || ''} onChange={(event) => set(code, 'amount', event.target.value)} placeholder="0.00" inputMode="decimal" /></Field>
                {Boolean(method.accepts_cash_received) && <Field label="النقد المستلم" ltr><TextField value={row.cashReceived || ''} onChange={(event) => set(code, 'cashReceived', event.target.value)} placeholder="0.00" inputMode="decimal" /></Field>}
                {!method.accepts_cash_received && <Field label="رقم المرجع" ltr><TextField value={row.referenceNumber || ''} onChange={(event) => set(code, 'referenceNumber', event.target.value)} /></Field>}
                <Field className="full" label="ملاحظة اختيارية"><TextField value={row.note || ''} onChange={(event) => set(code, 'note', event.target.value)} /></Field>
              </FieldGrid>
            </section>
          );
        })}
      </div>
    </div>
  );
}
