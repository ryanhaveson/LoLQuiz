'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

// Define a type for user admin data
interface UserAdmin {
  id: string;
  name?: string | null;
  email?: string | null;
  isAdmin: boolean;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refetching, setRefetching] = useState(false);
  const [refetchMsg, setRefetchMsg] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Fetch users if admin
  useEffect(() => {
    if (session?.user?.isAdmin) {
      fetch('/api/admin/users')
        .then(res => res.json())
        .then(data => setUsers(data))
        .catch(() => setError('Failed to load users'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session]);

  // Toggle admin status for a user
  const handleToggleAdmin = async (id: string, isAdmin: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isAdmin: !isAdmin })
      });
      if (!res.ok) throw new Error('Failed to update user');
      const updated = await res.json();
      setUsers(users => users.map(u => u.id === id ? { ...u, isAdmin: updated.isAdmin } : u));
    } catch {
      setError('Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  // Manually trigger patch data re-fetch
  const handleRefetchPatchData = async () => {
    setRefetching(true);
    setRefetchMsg('');
    try {
      const res = await fetch('/api/admin/refetch-patch-data', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to re-fetch patch data');
      setRefetchMsg('Patch data re-fetched successfully!');
    } catch {
      setRefetchMsg('Failed to re-fetch patch data');
    } finally {
      setRefetching(false);
    }
  };

  const handleDownloadPatchData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/patch/download');
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Failed to download patch data');
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!!session?.user && !session.user.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
        <button onClick={() => signOut()} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>
        
        {/* Patch Data Management */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Patch Data Management</h2>
          <button
            onClick={handleDownloadPatchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? 'Downloading...' : 'Download Latest Patch Data'}
          </button>
          {message && (
            <p className="mt-2 text-sm text-gray-600">{message}</p>
          )}
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Users</h2>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          <table className="w-full border border-black border-collapse">
            <thead>
              <tr>
                <th className="border border-black p-2">Name</th>
                <th className="border border-black p-2">Email</th>
                <th className="border border-black p-2">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="border border-black p-2">{user.name || '-'}</td>
                  <td className="border border-black p-2">{user.email || '-'}</td>
                  <td className="border border-black p-2 text-center">
                    <input
                      type="checkbox"
                      checked={user.isAdmin}
                      onChange={() => handleToggleAdmin(user.id, user.isAdmin)}
                      disabled={session?.user?.id === user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="w-full max-w-lg flex flex-col items-center">
          <button
            onClick={handleRefetchPatchData}
            className="px-6 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 mb-2"
            disabled={refetching}
          >
            {refetching ? 'Re-fetching...' : 'Re-fetch Patch Data'}
          </button>
          {refetchMsg && <div className="mt-2 text-green-600">{refetchMsg}</div>}
        </div>
      </div>
    </div>
  );
} 