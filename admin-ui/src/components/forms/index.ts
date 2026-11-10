/**
 * UX-B form component catalog — the canonical primitives every admin
 * screen uses for data entry. One label + hint + error contract
 * (FieldShell), one input shape per input type. Picker components
 * (CronFieldPicker, DateRangePicker, PeriodPicker, …) compose these
 * instead of rolling their own input markup.
 */
export { FieldShell, describedByFor } from './FieldShell';
export type { FieldShellProps } from './FieldShell';
export { TextInput } from './TextInput';
export type { TextInputProps } from './TextInput';
export { NumberInput } from './NumberInput';
export type { NumberInputProps } from './NumberInput';
export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';
export { DatePicker } from './DatePicker';
export type { DatePickerProps } from './DatePicker';
export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';
