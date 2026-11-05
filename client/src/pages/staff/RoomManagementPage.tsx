import React, { useState } from 'react';
import {
  useStaffRoomTypes,
  useCreateRoomType,
  useUpdateRoomType,
  useSetRoomTypeStatus,
} from '../../hooks/useRoomTypes.js';
import { useToast } from '../../context/ToastContext.js';
import { DataTable, Column } from '../../components/common/DataTable.js';
import { Pagination } from '../../components/common/Pagination.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Plus, Edit, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { RoomTypeDto, ApiError } from '../../types/api.js';

export const RoomManagementPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const limit = 10;
  const { success, error: toastError } = useToast();

  const { data, isLoading } = useStaffRoomTypes(page, limit);
  const createMutation = useCreateRoomType();
  const updateMutation = useUpdateRoomType();
  const setStatusMutation = useSetRoomTypeStatus();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    capacity: 2,
    facilities: 'Free Wi-Fi, Air conditioning, Smart TV',
    pricePerNight: 150,
    totalInventory: 3,
    imageUrl: '',
  });

  // Edit Modal State
  const [editingRoom, setEditingRoom] = useState<RoomTypeDto | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    capacity: 2,
    facilities: '',
    pricePerNight: 150,
    totalInventory: 3,
    imageUrl: '',
  });

  const [inventoryConflictError, setInventoryConflictError] = useState<string | null>(null);

  const roomTypes = data?.data ?? [];
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 };

  const handleOpenEdit = (room: RoomTypeDto) => {
    setEditingRoom(room);
    setEditForm({
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      facilities: room.facilities.join(', '),
      pricePerNight: room.pricePerNight,
      totalInventory: room.totalInventory,
      imageUrl: room.imageUrl || '',
    });
    setInventoryConflictError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        capacity: Number(createForm.capacity),
        facilities: createForm.facilities
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
        pricePerNight: Number(createForm.pricePerNight),
        totalInventory: Number(createForm.totalInventory),
        imageUrl: createForm.imageUrl.trim() || undefined,
        isActive: true,
      });

      success(`Room type "${createForm.name}" created successfully`, 'Created');
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        description: '',
        capacity: 2,
        facilities: 'Free Wi-Fi, Air conditioning, Smart TV',
        pricePerNight: 150,
        totalInventory: 3,
        imageUrl: '',
      });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Failed to create room type', 'Error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    setInventoryConflictError(null);

    try {
      await updateMutation.mutateAsync({
        id: editingRoom.id,
        data: {
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          capacity: Number(editForm.capacity),
          facilities: editForm.facilities
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean),
          pricePerNight: Number(editForm.pricePerNight),
          totalInventory: Number(editForm.totalInventory),
          imageUrl: editForm.imageUrl.trim() || undefined,
        },
      });

      success(`Room type "${editForm.name}" updated successfully`, 'Updated');
      setEditingRoom(null);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setInventoryConflictError(
          apiErr.message ||
            'Cannot reduce total inventory below already-booked nights in the future.',
        );
      } else {
        toastError(apiErr.message || 'Failed to update room type', 'Error');
      }
    }
  };

  const handleToggleStatus = async (room: RoomTypeDto) => {
    try {
      await setStatusMutation.mutateAsync({
        id: room.id,
        isActive: !room.isActive,
      });
      success(
        `Room type "${room.name}" is now ${!room.isActive ? 'Active' : 'Deactivated'}`,
        'Status Changed',
      );
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Failed to update status', 'Error');
    }
  };

  const columns: Column<RoomTypeDto>[] = [
    {
      key: 'name',
      header: 'Room Type Name',
      render: (room) => (
        <div>
          <span className="font-bold text-slate-800">{room.name}</span>
          <p className="text-xs text-slate-400 line-clamp-1">{room.description}</p>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (room) => <span>Up to {room.capacity} guests</span>,
    },
    {
      key: 'price',
      header: 'Price / Night',
      render: (room) => <span className="font-bold text-slate-900">${room.pricePerNight}</span>,
    },
    {
      key: 'inventory',
      header: 'Total Inventory',
      render: (room) => (
        <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
          {room.totalInventory} {room.totalInventory === 1 ? 'room' : 'rooms'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Active State',
      render: (room) =>
        room.isActive ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            Deactivated
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (room) => (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Edit} onClick={() => handleOpenEdit(room)}>
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={room.isActive ? ToggleRight : ToggleLeft}
            className={room.isActive ? 'text-emerald-600' : 'text-slate-400'}
            onClick={() => handleToggleStatus(room)}
          >
            {room.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Type Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure room types, pricing snapshots, and room capacities with inventory-protection
            guards
          </p>
        </div>

        <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsCreateOpen(true)}>
          Add New Room Type
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={roomTypes}
        keyExtractor={(room) => room.id}
        isLoading={isLoading}
        emptyTitle="No room types registered"
        emptyDescription="Get started by creating your first hotel room type."
      />

      <Pagination meta={meta} onPageChange={setPage} className="rounded-xl border shadow-sm" />

      {/* Create Room Type Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Room Type"
        description="Create a new accommodation option for guests."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Room Type Name"
            placeholder="e.g. Executive King Suite"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />

          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              placeholder="Describe room features, view, and furnishings..."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Guest Capacity"
              type="number"
              min={1}
              max={10}
              value={createForm.capacity}
              onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) })}
              required
            />

            <Input
              label="Total Inventory"
              type="number"
              min={1}
              max={100}
              value={createForm.totalInventory}
              onChange={(e) =>
                setCreateForm({ ...createForm, totalInventory: Number(e.target.value) })
              }
              required
            />

            <Input
              label="Price Per Night ($)"
              type="number"
              min={1}
              value={createForm.pricePerNight}
              onChange={(e) =>
                setCreateForm({ ...createForm, pricePerNight: Number(e.target.value) })
              }
              required
            />
          </div>

          <Input
            label="Facilities (comma-separated)"
            placeholder="Free Wi-Fi, Air conditioning, Mini-bar"
            value={createForm.facilities}
            onChange={(e) => setCreateForm({ ...createForm, facilities: e.target.value })}
            required
          />

          <Input
            label="Image URL (Optional)"
            placeholder="https://images.unsplash.com/photo-..."
            value={createForm.imageUrl}
            onChange={(e) => setCreateForm({ ...createForm, imageUrl: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createMutation.isPending}>
              Create Room Type
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Room Type Modal */}
      <Modal
        isOpen={!!editingRoom}
        onClose={() => setEditingRoom(null)}
        title={`Edit Room Type: ${editingRoom?.name}`}
        description="Update pricing and inventory details."
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {/* Inventory Conflict Alert */}
          {inventoryConflictError && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Inventory Reduction Rejected</span>
              </div>
              <p>{inventoryConflictError}</p>
            </div>
          )}

          <Input
            label="Room Type Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />

          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Guest Capacity"
              type="number"
              min={1}
              max={10}
              value={editForm.capacity}
              onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
              required
            />

            <Input
              label="Total Inventory"
              type="number"
              min={1}
              max={100}
              value={editForm.totalInventory}
              onChange={(e) => setEditForm({ ...editForm, totalInventory: Number(e.target.value) })}
              helperText="Cannot reduce below already-booked dates"
              required
            />

            <Input
              label="Price Per Night ($)"
              type="number"
              min={1}
              value={editForm.pricePerNight}
              onChange={(e) => setEditForm({ ...editForm, pricePerNight: Number(e.target.value) })}
              required
            />
          </div>

          <Input
            label="Facilities (comma-separated)"
            value={editForm.facilities}
            onChange={(e) => setEditForm({ ...editForm, facilities: e.target.value })}
            required
          />

          <Input
            label="Image URL (Optional)"
            value={editForm.imageUrl}
            onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingRoom(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
