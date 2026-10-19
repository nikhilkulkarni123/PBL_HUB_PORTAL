'use client';
import { useState } from 'react';
import Link from 'next/link';

export type Level = { id?: number; label: string; marks: number; descriptor: string };
export type Item = { id?: number; co: string; name: string; maxMarks: number; levels: Level[] };

export type ReviewData = {
  id: number;
  name: string;
  subjectCode: string;
  semester: number;
  programCode: string;
  status: string;
  startDate: string;
  lastDate: string;
  rubricTitle: string;
  requirementCount: number;
};

const newItem = (): Item => ({
  co: 'CO1',
  name: '',
  maxMarks: 5,
  levels: [5, 4, 3, 2, 1].map(n => ({ label: `Level ${n}`, marks: n, descriptor: '' }))
});

function parseCSV(text: string): Item[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const split = (s: string) => {
    const out: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        if (q && s[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim());
  };
  const h = split(lines[0]).map(x => x.toLowerCase());
  const map = new Map<string, Item>();
  for (const line of lines.slice(1)) {
    const a = split(line);
    const get = (n: string) => a[h.indexOf(n)] || '';
    const name = get('criterion');
    if (!name) continue;
    const key = `${get('co')}|${name}`;
    if (!map.has(key)) map.set(key, { co: get('co'), name, maxMarks: Number(get('max marks') || 0), levels: [] });
    map.get(key)!.levels.push({
      label: get('level') || `Level ${get('level marks')}`,
      marks: Number(get('level marks') || 0),
      descriptor: get('descriptor')
    });
  }
  return [...map.values()];
}

export default function ReviewEditor({
  review,
  initialItems
}: {
  review: ReviewData;
  initialItems: Item[];
}) {
  const [reviewName, setReviewName] = useState(review.name || '');
  const [subjectCode, setSubjectCode] = useState(review.subjectCode || '');
  const [title, setTitle] = useState(review.rubricTitle || 'PBL Assessment Rubric');
  const [startDate, setStartDate] = useState(review.startDate || '');
  const [lastDate, setLastDate] = useState(review.lastDate || '');
  const [items, setItems] = useState<Item[]>(initialItems.length ? initialItems : [newItem()]);

  const total = items.reduce((s, i) => s + Number(i.maxMarks || 0), 0);
  const isPublished = review.status === 'PUBLISHED';

  // Check if last date has passed
  const isDeadlineEnded = (() => {
    if (!lastDate) return false;
    const deadline = new Date(`${lastDate}T23:59:59.999`);
    return deadline.getTime() < Date.now();
  })();

  function patchItem(i: number, p: Partial<Item>) {
    setItems(x => x.map((v, k) => k === i ? { ...v, ...p } : v));
  }

  function patchLevel(i: number, j: number, p: Partial<Level>) {
    setItems(x => x.map((v, k) => k === i ? {
      ...v,
      levels: v.levels.map((l, z) => z === j ? { ...l, ...p } : l)
    } : v));
  }

  async function importFile(file: File) {
    const parsed = parseCSV(await file.text());
    if (parsed.length) setItems(parsed);
  }

  // Helper to extend last date by N days
  function extendLastDateByDays(days: number) {
    const base = new Date();
    // If current lastDate is in the future, add to it; otherwise add to today
    const current = lastDate ? new Date(`${lastDate}T00:00:00`) : new Date();
    const startPoint = current.getTime() > base.getTime() ? current : base;
    startPoint.setDate(startPoint.getDate() + days);

    const y = startPoint.getFullYear();
    const m = String(startPoint.getMonth() + 1).padStart(2, '0');
    const d = String(startPoint.getDate()).padStart(2, '0');
    setLastDate(`${y}-${m}-${d}`);
  }

  return (
    <div className="form" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/coordinator/rubrics" className="btn secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>
          ← Back to Existing Reviews
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px' }}>Edit Review & Rubric</h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            Institution: <b>{review.programCode === 'GMIT-CSE' ? 'GMIT' : 'GMU'}</b> · Semester: <b>{review.semester}</b>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: isPublished ? '#e0f2fe' : '#fef3c7',
            color: isPublished ? '#0369a1' : '#92400e'
          }}>
            Status: {review.status}
          </span>
        </div>
      </div>

      {isPublished && (
        <div className="notice" style={{
          background: isDeadlineEnded ? '#fee2e2' : '#eff6ff',
          borderColor: isDeadlineEnded ? '#fca5a5' : '#93c5fd',
          color: isDeadlineEnded ? '#991b1b' : '#1e40af',
          margin: '18px 0'
        }}>
          {isDeadlineEnded ? (
            <div>
              <b>⚠️ Submission Deadline Ended:</b> The last date for student submissions has ended and submissions are currently locked for students.
              <br />
              <b>To extend the deadline:</b> Set a new <b>Submission Last Date</b> below and click <b>Save Changes</b>. Submissions will reopen immediately!
            </div>
          ) : (
            <div>
              ℹ️ <b>Review is PUBLISHED:</b> You can update submission dates, review name, criteria, and descriptors. Changes will be reflected immediately.
            </div>
          )}
        </div>
      )}

      <form action={`/api/coordinator/reviews/${review.id}/edit`} method="post">
        <input type="hidden" name="rubricJson" value={JSON.stringify({ items })} />

        <h2>1. Review Details & Submission Dates</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div className="field">
            <label>Review Name</label>
            <input
              name="reviewName"
              value={reviewName}
              onChange={e => setReviewName(e.target.value)}
              placeholder="e.g. Review 1"
              required
            />
          </div>
          <div className="field">
            <label>Subject Code</label>
            <input
              name="subjectCode"
              value={subjectCode}
              onChange={e => setSubjectCode(e.target.value)}
              placeholder="e.g. 21CS51"
            />
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', margin: '14px 0 24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: 'var(--navy)' }}>
            Submission Date Window {isDeadlineEnded && <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 'bold' }}>(Currently Ended)</span>}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Submission Start Date</label>
              <input
                name="submissionStartDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Submission Last Date (Deadline)</label>
              <input
                name="submissionLastDate"
                type="date"
                value={lastDate}
                onChange={e => setLastDate(e.target.value)}
                required
                style={{ borderColor: isDeadlineEnded ? '#ef4444' : undefined }}
              />
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginRight: '8px' }}>
              Quick Extend:
            </span>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px' }}
              onClick={() => extendLastDateByDays(3)}
            >
              +3 Days
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px' }}
              onClick={() => extendLastDateByDays(7)}
            >
              +1 Week
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px' }}
              onClick={() => extendLastDateByDays(14)}
            >
              +2 Weeks
            </button>
          </div>
        </div>

        <h2>2. Rubric Details & Criteria</h2>
        <div className="field">
          <label>Rubric Title</label>
          <input
            name="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><b>Total Rubric Marks: {total}</b></span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Sum of all criteria max marks</span>
        </div>

        <div style={{ margin: '18px 0' }}>
          {items.map((it, i) => (
            <div className="card" key={it.id ? `id-${it.id}` : `idx-${i}`} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Criterion {i + 1}</h3>
                <button
                  type="button"
                  className="btn danger"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => setItems(x => x.filter((_, k) => k !== i))}
                  disabled={items.length <= 1}
                >
                  Delete Criterion
                </button>
              </div>

              <div className="designer-grid">
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block' }}>CO Code</label>
                  <input
                    value={it.co || ''}
                    onChange={e => patchItem(i, { co: e.target.value })}
                    placeholder="CO1"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block' }}>Criterion Name</label>
                  <input
                    value={it.name}
                    onChange={e => patchItem(i, { name: e.target.value })}
                    placeholder="Criterion name"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block' }}>Max Marks</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={it.maxMarks}
                    onChange={e => patchItem(i, { maxMarks: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <h4 style={{ margin: '14px 0 8px', fontSize: '14px', color: 'var(--muted)' }}>Performance Levels</h4>
              {it.levels.map((l, j) => (
                <div key={l.id ? `lvl-${l.id}` : `lvl-idx-${j}`} className="level-grid">
                  <input
                    value={l.label}
                    onChange={e => patchLevel(i, j, { label: e.target.value })}
                    placeholder="Level Label"
                    required
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={l.marks}
                    onChange={e => patchLevel(i, j, { marks: Number(e.target.value) })}
                    placeholder="Marks"
                    required
                  />
                  <input
                    value={l.descriptor}
                    onChange={e => patchLevel(i, j, { descriptor: e.target.value })}
                    placeholder="Performance descriptor"
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => patchItem(i, { levels: it.levels.filter((_, z) => z !== j) })}
                    disabled={it.levels.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => patchItem(i, {
                    levels: [...it.levels, { label: `Level ${it.levels.length + 1}`, marks: 0, descriptor: '' }]
                  })}
                >
                  + Add Level
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn secondary"
            onClick={() => setItems(x => [...x, newItem()])}
          >
            + Add Criterion
          </button>
        </div>

        <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />

        <div className="field">
          <label>Import Rubric CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => e.target.files?.[0] && importFile(e.target.files[0])}
          />
          <small className="muted">
            Columns: Criterion, CO, Max Marks, Level, Level Marks, Descriptor.
          </small>
        </div>

        <div className="card" style={{ background: '#f8fafc', margin: '24px 0', border: '1px solid #cbd5e1' }}>
          <h3 style={{ margin: '0 0 8px' }}>Submission File Requirements</h3>
          <p className="muted" style={{ margin: '0 0 12px' }}>
            Currently configured: <b>{review.requirementCount}</b> submission file requirement(s).
          </p>
          <Link
            href={`/coordinator/reviews/${review.id}/requirements`}
            className="btn secondary"
          >
            Manage / Edit Submission File Requirements →
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button className="btn" name="action" value="SAVE">
            Save Changes
          </button>
          {!isPublished && (
            <button className="btn" name="action" value="PUBLISH" style={{ background: '#0f8a5f' }}>
              Publish Review
            </button>
          )}
          <Link href="/coordinator/rubrics" className="btn secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
