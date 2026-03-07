'use client';

import React from 'react';
import { useUser } from '@/app/contexts/UserContext';

export default function UserSelector() {
    const { users, selectedUser, setSelectedUser, loading } = useUser();

    if (loading) return <div className="text-sm text-gray-500">Loading users...</div>;
    if (users.length === 0) return null;

    return (
        <div className="flex items-center space-x-2">
            <label htmlFor="user-select" className="text-sm font-medium text-gray-700">
                ユーザー切替:
            </label>
            <select
                id="user-select"
                className="block w-48 rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm shadow-sm border"
                value={selectedUser?.id || ''}
                onChange={(e) => {
                    const user = users.find(u => u.id === e.target.value);
                    if (user) setSelectedUser(user);
                }}
            >
                {users.map(user => (
                    <option key={user.id} value={user.id}>
                        {user.displayName} ({user.role})
                    </option>
                ))}
            </select>
        </div>
    );
}
