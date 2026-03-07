'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
    id: string;
    displayName: string;
    role: 'Admin' | 'Editor' | 'Viewer';
}

interface UserContextType {
    selectedUser: User | null;
    setSelectedUser: (user: User) => void;
    users: User[];
    loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/users');
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data);
                    if (data.length > 0) {
                        setSelectedUser(data[0]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch users:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    return (
        <UserContext.Provider value={{ selectedUser, setSelectedUser, users, loading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
