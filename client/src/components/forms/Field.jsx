import { cloneElement, isValidElement, useId } from 'react';
import { FormLabel, TextField } from '@mui/material';

const ALWAYS_SHRINK_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function isMuiTextField(child) {
  return isValidElement(child)
    && (child.type === TextField || child.type?.muiName === 'TextField');
}

/**
 * Shared A4 field wrapper.
 *
 * MUI TextField children use the native outlined label/notch animation.
 * Custom controls keep an external label. MUI v9 slotProps are used so no
 * implementation props leak to native DOM elements.
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
  const ltrClass = ltr ? 'field--ltr' : '';
  const fieldClassName = `field ${densityClass} ${ltrClass} ${className}`.trim();

  if (isMuiTextField(children)) {
    const existingSlots = children.props.slotProps || {};
    const inputLabelSlot = existingSlots.inputLabel || {};
    const htmlInputSlot = existingSlots.htmlInput || {};

    const mustStayShrunk = Boolean(
      children.props.select
      || ALWAYS_SHRINK_TYPES.has(children.props.type)
      || inputLabelSlot.shrink,
    );

    const isLtrField = ltr
      || children.props.type === 'number'
      || children.props.type === 'tel'
      || htmlInputSlot.dir === 'ltr'
      || children.props.slotProps?.htmlInput?.dir === 'ltr';

    const control = cloneElement(children, {
      id: children.props.id || `a4-field-${generatedId}`,
      label: label || children.props.label,
      required: required || children.props.required,
      error: Boolean(error) || Boolean(children.props.error),
      helperText: error || hint || children.props.helperText,
      fullWidth: children.props.fullWidth ?? true,
      size: children.props.size || (density === 'compact' ? 'small' : 'medium'),
      variant: children.props.variant || 'outlined',
      slotProps: {
        ...existingSlots,
        inputLabel: {
          ...inputLabelSlot,
          ...(mustStayShrunk ? { shrink: true } : {}),
        },
        htmlInput: {
          ...htmlInputSlot,
          ...(isLtrField ? { dir: 'ltr', className: `${htmlInputSlot.className || ''} a4-ltr-value`.trim() } : {}),
        },
      },
    });

    return <div className={fieldClassName}>{control}</div>;
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
