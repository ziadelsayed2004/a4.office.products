import { cloneElement, isValidElement, useId } from 'react';
import { FormLabel, TextField } from '@mui/material';
import './Field.css';

const ALWAYS_SHRINK_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function isMuiTextField(child) {
  return isValidElement(child) && (child.type === TextField || child.type?.muiName === 'TextField');
}

function mergeInputLabelSlot(slot, forceShrink) {
  if (!forceShrink) return slot;
  if (typeof slot === 'function') {
    return (ownerState) => ({ ...slot(ownerState), shrink: true });
  }
  return { ...slot, shrink: true };
}

function mergeHtmlInputSlot(slot) {
  const applyDefaults = (resolvedSlot = {}) => {
    return {
      ...resolvedSlot,
      dir: 'rtl',
    };
  };

  if (typeof slot === 'function') {
    return (ownerState) => applyDefaults(slot(ownerState));
  }

  return applyDefaults(slot);
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
  density = 'normal',
}) {
  const generatedId = useId().replace(/:/g, '');
  const normalizedDensity =
    density === 'comfortable' ? 'comfortable' : density === 'compact' ? 'compact' : 'normal';
  const densityClass = `field--${normalizedDensity}`;
  const fieldClassName = `field ${densityClass} ${className}`.trim();

  if (isMuiTextField(children)) {
    const existingSlots = children.props.slotProps ?? {};
    const existingInputLabel = existingSlots.inputLabel ?? {};
    const existingHtmlInput = existingSlots.htmlInput ?? {};
    const type = children.props.type;
    const effectiveLabel = label ?? children.props.label;
    const forceShrink =
      ALWAYS_SHRINK_TYPES.has(type) ||
      (typeof existingInputLabel !== 'function' && existingInputLabel.shrink === true);

    return (
      <div className={fieldClassName}>
        {cloneElement(children, {
          id: children.props.id || `a4-field-${generatedId}`,
          label: effectiveLabel,
          // A labelled outlined field has one piece of inline copy. The label
          // starts inside the box and becomes the native MUI notch on focus or
          // when filled; keeping a second placeholder duplicates that copy.
          placeholder: effectiveLabel ? undefined : children.props.placeholder,
          required: required || children.props.required,
          error: Boolean(error) || Boolean(children.props.error),
          helperText: error || hint || children.props.helperText,
          fullWidth: children.props.fullWidth ?? true,
          size: children.props.size || (normalizedDensity === 'comfortable' ? 'medium' : 'small'),
          variant: children.props.variant || 'outlined',
          slotProps: {
            ...existingSlots,
            inputLabel: mergeInputLabelSlot(existingInputLabel, forceShrink),
            htmlInput: mergeHtmlInputSlot(existingHtmlInput),
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
      {error ? (
        <span className="field__error">{error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export default Field;
