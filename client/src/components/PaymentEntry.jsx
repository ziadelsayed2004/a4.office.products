import { Alert, TextField } from '@mui/material';
import { Field } from './forms/Field.jsx';
import { money } from '../utils/formatters.js';
import { parsePiasters } from '../utils/money.js';
import { isValidCustomerPhone, normalizeCustomerPhone } from '../utils/customerPhone.js';
import './PaymentEntry.css';

function methodCode(method) {
  return method.code || method.method || method.id;
}

function evidenceConfig(method) {
  const code = String(methodCode(method)).toLowerCase();
  if (code === 'card') {
    return {
      label: 'آخر 4 أرقام من البطاقة',
      placeholder: '1234',
      inputMode: 'numeric',
      maxLength: 4,
      normalize: (value) => normalizeCustomerPhone(value).slice(0, 4),
      validate: (value) => /^\d{4}$/.test(normalizeCustomerPhone(value)),
      error: 'اكتب آخر 4 أرقام من البطاقة.',
    };
  }
  if (code === 'instapay') {
    return {
      label: 'رقم هاتف إنستا باي',
      placeholder: '01xxxxxxxxx',
      inputMode: 'tel',
      maxLength: 30,
      normalize: normalizeCustomerPhone,
      validate: isValidCustomerPhone,
      error: 'اكتب رقم هاتف إنستا باي الصحيح.',
    };
  }
  if (code === 'wallet') {
    return {
      label: 'رقم هاتف المحفظة',
      placeholder: '01xxxxxxxxx',
      inputMode: 'tel',
      maxLength: 30,
      normalize: normalizeCustomerPhone,
      validate: isValidCustomerPhone,
      error: 'اكتب رقم هاتف المحفظة الصحيح.',
    };
  }
  if (!method.accepts_cash_received) {
    return {
      label: 'بيانات عملية الدفع',
      placeholder: 'رقم العملية أو التحويل',
      inputMode: 'text',
      maxLength: 200,
      normalize: (value) => value,
      validate: (value) => Boolean(String(value || '').trim()),
      error: 'اكتب بيانات عملية الدفع.',
    };
  }
  return null;
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
    const evidence = evidenceConfig(method);
    const referenceNumber = row.referenceNumber?.trim() || null;
    if (evidence && !evidence.validate(referenceNumber)) throw new Error(evidence.error);
    const payment = {
      method: code,
      amount,
      referenceNumber: evidence?.normalize(referenceNumber) || null,
      note: row.note?.trim() || null,
    };
    if (method.accepts_cash_received) {
      payment.cashReceived = parsePiasters(row.cashReceived || row.amount);
      if (payment.cashReceived < amount)
        throw new Error('المبلغ النقدي المستلم أقل من المبلغ المطبق.');
    }
    payload.push(payment);
    total += amount;
  }
  if (Number(due) === 0 && payload.length === 0) return [];
  if (total !== Number(due))
    throw new Error(`إجمالي الدفعات ${money(total)} لا يساوي المطلوب ${money(due)}.`);
  return payload;
}

export function paymentRowsAreComplete(methods, rows, due) {
  try {
    paymentRowsToPayload(methods, rows, due);
    return true;
  } catch {
    return false;
  }
}

export function PaymentEntry({ methods, due, value, onChange }) {
  const set = (code, key, nextValue) => {
    onChange({ ...value, [code]: { ...value[code], [key]: nextValue } });
  };
  const setCollectedAmount = (method, nextValue) => {
    const code = methodCode(method);
    const nextRow = { ...value[code], amount: nextValue };
    if (method.accepts_cash_received) nextRow.cashReceived = nextValue;
    onChange({ ...value, [code]: nextRow });
  };
  const preview = methods.reduce(
    (result, method) => {
      const code = methodCode(method);
      const row = value[code] || {};
      try {
        const amount = row.amount ? parsePiasters(row.amount) : 0;
        result.applied += amount;
      } catch {
        result.invalid = true;
      }
      return result;
    },
    { applied: 0, invalid: false }
  );
  const remaining = Math.max(0, Number(due) - preview.applied);
  const excess = Math.max(0, preview.applied - Number(due));
  const complete = paymentRowsAreComplete(methods, value, due);

  return (
    <div className="payment-entry">
      <Alert severity={complete ? 'success' : excess > 0 || preview.invalid ? 'error' : 'info'}>
        المطلوب {money(due)} · المحصّل {money(preview.applied)}
        {remaining > 0 ? ` · المتبقي ${money(remaining)}` : ''}
        {excess > 0 ? ` · زيادة ${money(excess)}` : ''}
      </Alert>
      <div className="payment-entry__methods">
        {methods.map((method) => {
          const code = methodCode(method);
          const row = value[code] || {};
          const evidence = evidenceConfig(method);
          return (
            <section className="payment-entry__method" key={code}>
              <strong>{method.name_ar || method.name || code}</strong>
              <div className="payment-entry__fields">
                <Field label="المبلغ المحصّل">
                  <TextField
                    value={row.amount || ''}
                    onChange={(event) => setCollectedAmount(method, event.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </Field>
                {evidence && (
                  <Field label={evidence.label}>
                    <TextField
                      value={row.referenceNumber || ''}
                      onChange={(event) =>
                        set(code, 'referenceNumber', evidence.normalize(event.target.value))
                      }
                      placeholder={evidence.placeholder}
                      inputMode={evidence.inputMode}
                      slotProps={{ htmlInput: { maxLength: evidence.maxLength, dir: 'ltr' } }}
                    />
                  </Field>
                )}
                <Field label="ملاحظة اختيارية">
                  <TextField
                    value={row.note || ''}
                    onChange={(event) => set(code, 'note', event.target.value)}
                  />
                </Field>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
