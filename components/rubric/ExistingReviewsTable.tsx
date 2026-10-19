'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dateOnlyLabel, toDateInputValue } from '@/lib/review-dates';

export type ReviewRow = {
  id: number;
  name: string;
  maximum_marks: number | string;
  status: string;
  submission_open_at: string | null;
  submission_deadline: string | null;
  semester: number;
  title: string | null;
  program_code: string;
  requirement_count: number;
};

export default function ExistingReviewsTable({ reviews }: { reviews: ReviewRow[] }) {
  const router = useRouter();
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalLastDate, setModalLastDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function openExtendModal(r: ReviewRow) {
    setSelectedReview(r);
    setModalStartDate(toDateInputValue(r.submission_open_at));
    setModalLastDate(toDateInputValue(r.submission_deadline));
    setModalError(null);
  }

  function closeExtendModal() {
    setSelectedReview(null);
    setModalError(null);
    setIsSubmitting(false);
  }

  function quickAddDays(days: number) {
    const today = new Date();
    const current = modalLastDate ? new Date(`${modalLastDate}T00:00:00`) : new Date();
    const base = current.getTime() > today.getTime() ? current : today;
    base.setDate(base.getDate() + days);

    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    setModalLastDate(`${y}-${m}-${d}`);
  }

  function quickSetEndOfMonth() {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    // last day of current month
    const lastDay = new Date(y, m + 1, 0).getDate();
    const monthStr = String(m + 1).padStart(2, '0');
    setModalLastDate(`${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`);
  }

  async function handleDatesSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReview) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/coordinator/reviews/${selectedReview.id}/dates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          submissionStartDate: modalStartDate,
          submissionLastDate: modalLastDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update submission dates');
      }

      closeExtendModal();
      router.refresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update dates');
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Semester</th>
              <th>Review</th>
              <th>Rubric</th>
              <th>Marks</th>
              <th>Submission Files</th>
              <th>Start Date</th>
              <th>Last Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((x) => {
              const isDeadlinePassed = x.submission_deadline
                ? new Date(x.submission_deadline).getTime() < Date.now()
                : false;
              const isPublished = x.status === 'PUBLISHED';

              return (
                <tr key={x.id}>
                  <td>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: x.program_code === 'GMIT-CSE' ? '#fef3c7' : '#e0f2fe',
                        color: x.program_code === 'GMIT-CSE' ? '#92400e' : '#0369a1'
                      }}
                    >
                      {x.program_code === 'GMIT-CSE' ? 'GMIT' : 'GMU'}
                    </span>
                  </td>
                  <td>{x.semester}</td>
                  <td><b>{x.name}</b></td>
                  <td>{x.title || '—'}</td>
                  <td>{x.maximum_marks}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{x.requirement_count} file(s)</span>
                  </td>
                  <td>{dateOnlyLabel(x.submission_open_at)}</td>
                  <td>
                    <span style={{ color: isDeadlinePassed && isPublished ? '#dc2626' : undefined, fontWeight: isDeadlinePassed && isPublished ? 'bold' : undefined }}>
                      {dateOnlyLabel(x.submission_deadline)}
                    </span>
                  </td>
                  <td>
                    {isPublished ? (
                      isDeadlinePassed ? (
                        <span
                          className="status"
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Last date ended. Submissions are locked for students. Click 'Extend Date' to reopen."
                        >
                          <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#dc2626' }}></span>
                          Deadline Ended
                        </span>
                      ) : (
                        <span
                          className="status"
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#0284c7' }}></span>
                          PUBLISHED
                        </span>
                      )
                    ) : (
                      <span className="status" style={{ background: '#fef3c7', color: '#92400e' }}>
                        DRAFT
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          fontSize: '12px',
                          padding: '6px 11px',
                          backgroundColor: isDeadlinePassed && isPublished ? '#dc2626' : '#1f6feb'
                        }}
                        onClick={() => openExtendModal(x)}
                        title="Extend or change submission start and last date"
                      >
                        📅 Extend Date
                      </button>

                      <Link
                        className="btn secondary"
                        style={{ fontSize: '12px', padding: '6px 11px' }}
                        href={`/coordinator/reviews/${x.id}/edit`}
                        title="Edit rubric criteria, COs, levels, and review details"
                      >
                        Edit Rubric
                      </Link>

                      <Link
                        className="btn secondary"
                        style={{ fontSize: '12px', padding: '6px 11px' }}
                        href={`/coordinator/reviews/${x.id}/requirements`}
                        title="Edit required submission files"
                      >
                        Edit Requirements
                      </Link>

                      {!isPublished && (
                        <form style={{ display: 'inline' }} action={`/api/coordinator/reviews/${x.id}/publish`} method="post">
                          <button
                            className="btn"
                            style={{ fontSize: '12px', padding: '6px 11px', backgroundColor: '#0f8a5f' }}
                          >
                            Publish
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Date Extension Modal */}
      {selectedReview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeExtendModal();
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--navy)' }}>
                  Extend Submission Date
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  {selectedReview.name} · Semester {selectedReview.semester} ({selectedReview.program_code === 'GMIT-CSE' ? 'GMIT' : 'GMU'})
                </p>
              </div>
              <button
                type="button"
                onClick={closeExtendModal}
                style={{
                  background: 'transparent',
                  border: 0,
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--muted)'
                }}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="notice error" style={{ margin: '0 0 16px', fontSize: '13px' }}>
                <b>Error:</b> {modalError}
              </div>
            )}

            <form onSubmit={handleDatesSubmit}>
              <div className="field">
                <label style={{ fontSize: '13px' }}>Submission Start Date</label>
                <input
                  type="date"
                  value={modalStartDate}
                  onChange={(e) => setModalStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label style={{ fontSize: '13px' }}>Submission Last Date (Deadline)</label>
                <input
                  type="date"
                  value={modalLastDate}
                  onChange={(e) => setModalLastDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  Quick Extension Shortcuts:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => quickAddDays(3)}
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => quickAddDays(7)}
                  >
                    +1 Week
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => quickAddDays(14)}
                  >
                    +2 Weeks
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={quickSetEndOfMonth}
                  >
                    End of Month
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={closeExtendModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Save & Extend Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
