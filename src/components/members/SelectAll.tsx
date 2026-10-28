'use client';

// Case « tout sélectionner » : coche ou décoche toutes les cases de membres du même formulaire.
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Sélectionner tous les membres"
      className="size-4"
      onChange={(event) => {
        const form = event.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>('input[name="profileIds"]').forEach((box) => {
          box.checked = event.currentTarget.checked;
        });
      }}
    />
  );
}
