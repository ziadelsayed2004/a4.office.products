import { cloneElement, isValidElement, useId } from 'react';
import { FormLabel, TextField } from '@mui/material';

const ALWAYS_SHRINK_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function isMuiTextField(child) {
  return isValidElement(child)
    && (child.type === TextField || child.type?.muiName === 'TextField');
}

/**
 * Shared A4 form field.
 *
 * TextField children receive a real MUI outlined label so the label animates
 * into an RTL-safe notch. Non-TextField controls (switch groups, custom
 * widgets, etc.) keep a compact external label.
 */
export function Field({ label, required = false, hint, error, children, className = '' }) {
  const generatedId = useId().replace(/:/g, '');
  const fieldClassName = `field${className ? ` ${className}` : ''}`;

  if (isMuiTextField(children)) {
    const childInputLabelProps = children.props.InputLabelProps || {};
    const mustStayShrunk = Boolean(
      children.props.select
      || ALWAYS_SHRINK_TYPES.has(children.props.type)
      || childInputLabelProps.shrink,
    );

    const control = cloneElement(children, {
      id: children.props.id || `a4-field-${generatedId}`,
      label: label || children.props.label,
      required: required || children.props.required,
      error: Boolean(error) || Boolean(children.props.error),
      helperText: error || hint || children.props.helperText,
      fullWidth: children.props.fullWidth ?? true,
      size: children.props.size || 'small',
      variant: children.props.variant || 'outlined',
      InputLabelProps: {
        ...childInputLabelProps,
        ...(mustStayShrunk ? { shrink: true } : {}),
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
