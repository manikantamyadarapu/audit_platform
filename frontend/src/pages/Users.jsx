import { useState, useEffect } from 'react';
import { Search, Plus, MoreVertical, Mail, X, AlertCircle, Loader2 } from 'lucide-react';

// API helper function
const API_BASE_URL = '/api/v1';

function getToken() {
  return localStorage.getItem('token');
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

// Toast notification component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
      type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
    }`}>
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// User Card Component
function UserCard({ user, onEdit, onDelete }) {
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700';
      case 'AUDITOR':
        return 'bg-blue-100 text-blue-700';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg">
            {getInitials(user.name)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{user.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {user.isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onEdit(user)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit user"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(user.role)}`}>
            {user.role}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="h-4 w-4 text-gray-400" />
          <span className="truncate">{user.email}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Created: {new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => onEdit(user)}
          className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(user)}
          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// User Modal Component
function UserModal({ isOpen, onClose, onSave, user, title, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'AUDITOR',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'AUDITOR',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'AUDITOR',
      });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!!user}
            />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required={!user}
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="AUDITOR">AUDITOR</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {user ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteModal({ isOpen, onClose, onConfirm, user, isLoading }) {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete User?</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Users Page
export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState(null);

  const fetchUsers = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const data = await apiRequest(`/users?page=${page}&limit=10&search=${search}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, searchQuery);
  }, [searchQuery]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleCreateUser = async (formData) => {
    try {
      setIsModalLoading(true);
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      showToast('User created successfully');
      setIsModalOpen(false);
      fetchUsers(pagination.page, searchQuery);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleUpdateUser = async (formData) => {
    try {
      setIsModalLoading(true);
      await apiRequest(`/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: formData.name, role: formData.role }),
      });
      showToast('User updated successfully');
      setIsModalOpen(false);
      setEditingUser(null);
      fetchUsers(pagination.page, searchQuery);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setIsDeleteLoading(true);
      await apiRequest(`/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      showToast('User deleted successfully');
      setIsDeleteModalOpen(false);
      setDeletingUser(null);
      fetchUsers(pagination.page, searchQuery);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const openDeleteModal = (user) => {
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} registered users</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name, email, role..."
          value={searchQuery}
          onChange={handleSearch}
          className="w-full max-w-md pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => (
              <UserCard 
                key={user.id} 
                user={user} 
                onEdit={openEditModal}
                onDelete={openDeleteModal}
              />
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found matching your search.</p>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchUsers(page, searchQuery)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    page === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSave={editingUser ? handleUpdateUser : handleCreateUser}
        user={editingUser}
        title={editingUser ? 'Edit User' : 'Create User'}
        isLoading={isModalLoading}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingUser(null);
        }}
        onConfirm={handleDeleteUser}
        user={deletingUser}
        isLoading={isDeleteLoading}
      />
    </div>
  );
}
