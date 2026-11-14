import { Field, Input, Select } from './ui';

// Isian Informasi Dokumen yang ditentukan oleh kategori/subkategori (lihat electron/catalog.js).
export function ExtraFieldsInput({ fields, values, errors = {}, onChange }) {
  if (!fields.length) return null;
  return fields.map((f) => (
    <Field key={f.key} label={f.label} required={f.required} error={errors[f.key]} hint={f.hint}>
      <ExtraInput field={f} value={values[f.key] ?? ''} onChange={(v) => onChange(f.key, v)} />
    </Field>
  ));
}

function ExtraInput({ field, value, onChange }) {
  switch (field.type) {
    case 'select':
      return (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Pilih…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case 'date':
      return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'month':
      return <Input type="month" value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'currency':
      return (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">Rp</span>
          <Input
            className="pl-9 tabular-nums"
            inputMode="numeric"
            value={value ? Number(value).toLocaleString('id-ID') : ''}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15))}
            placeholder="0"
          />
        </div>
      );
    case 'number':
      return (
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
          placeholder={field.placeholder}
          maxLength={20}
        />
      );
    default:
      return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={200} />;
  }
}

// Validasi sisi tampilan; aturan yang sama diperiksa ulang di proses utama.
export function validateExtraFields(fields, values) {
  const errors = {};
  for (const f of fields) {
    const v = String(values[f.key] ?? '').trim();
    if (!v) {
      if (f.required) errors[f.key] = `${f.label} wajib diisi.`;
    } else if (f.type === 'number' && !/^\d+(\.\d+)?$/.test(v)) {
      errors[f.key] = `${f.label} harus berupa angka.`;
    }
  }
  return errors;
}
