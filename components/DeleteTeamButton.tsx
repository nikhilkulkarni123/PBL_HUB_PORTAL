'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteTeamButton({
  teamId,
  teamCode,
  teamName,
}: {
  teamId: number;
  teamCode: string;
  teamName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete team "${teamName}" (${teamCode})?\n\nThis will remove the team and free all its members to join other teams.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/coordinator/teams/${teamId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete team.');
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'An error occurred while deleting the team.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="btn secondary"
      style={{
        padding: '0.35rem 0.65rem',
        fontSize: '0.85rem',
        color: '#000000',
        borderColor: '#000000',
        cursor: deleting ? 'not-allowed' : 'pointer',
        opacity: deleting ? 0.6 : 1,
      }}
      title="Delete team and release members"
    >
      {deleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}
