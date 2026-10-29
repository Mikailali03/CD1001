/**
 * Inline validation message shown under a form field. Pair it with
 * `aria-invalid` and `aria-describedby={id}` on the input so screen readers
 * announce the error with the field.
 */
export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}
