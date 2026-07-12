import { cloneElement, isValidElement, useId } from 'react';
import { FormLabel, TextField } from '@mui/material';

const ALWAYS_SHRINK_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function isMuiTextField(child) {
  return isValidElement(child)
    && (child.type === TextField || child.type?.muiName === 'TextField');
}

/**
 * Canonical A4 field wrapper.
 *
 * TextField children keep the native MUI outlined label, fieldset and legend.
 * The component only supplies product defaults and MUI v9 slotProps; it never
 * draws or manually transforms the notch.
 */
export function Field({
  label,
  required = false,
  hint,
  error,
  children,
  className = '',
  density = 'comfortable',
  ltr = false,
}) {
  const generatedId = useId().replace(/:/g, '');
  const densityClass = density === 'compact' ? 'field--compact' : 'field--comfortable';
  const fieldClassName = `field ${densityClass} ${ltr ? 'field--ltr' : ''} ${className}`.trim();

  if (isMuiTextField(children)) {
    const existingSlots = children.props.slotProps ?? {};
    const existingInputLabel = existingSlots.inputLabel ?? {};
    const existingHtmlInput = existingSlots.htmlInput ?? {};
    const type = children.props.type;
    const localLtr = ltr
      || type === 'number'
      || type === 'tel'
      || existingHtmlInput.dir === 'ltr';
    const forceShrink = ALWAYS_SHRINK_TYPES.has(type) || existingInputLabel.shrink === true;

    return (
      <div className={fieldClassName}>
        {cloneElement(children, {
          id: children.props.id || `a4-field-${generatedId}`,
          label: label ?? children.props.label,
          required: required || children.props.required,
          error: Boolean(error) || Boolean(children.props.error),
          helperText: error || hint || children.props.helperText,
          fullWidth: children.props.fullWidth ?? true,
          size: children.props.size || (density === 'compact' ? 'small' : 'medium'),
          variant: children.props.variant || 'outlined',
          slotProps: {
            ...existingSlots,
            inputLabel: {
              ...existingInputLabel,
              ...(forceShrink ? { shrink: true } : {}),
            },
            htmlInput: {
              ...existingHtmlInput,
              ...(localLtr
                ? {
                    dir: 'ltr',
                    className: `${existingHtmlInput.className || ''} a4-ltr-value`.trim(),
                  }
                : { dir: 'rtl' }),
            },
          },
        })}
      </div>
    );
  }

  return (
    <div className={fieldClassName}>
      {label && (
        <FormLabel className="field__external-label">
          {label}
          {required && <span className="field__required">*</span>}
        </FormLabel>
      )}
      {children}
      {error
        ? <span className="field__error">{error}</span>
        : hint
          ? <span className="field__hint">{hint}</span>
          : null}
    </div>
  );
}
