import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Upload,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Search,
  Download,
  ExternalLink,
  HardDrive,
  Files
} from 'lucide-react';
import api from '../services/api';

// ============================================================================
// Types
// ============================================================================

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  file_count: number;
}

interface Resource {
  id: string;
  topic_id: string;
  file_name: string;
  s3_key: string;
  s3_url: string;
  content_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface DashboardStats {
  total_topics: number;
  total_resources: number;
  total_size_bytes: number;
  total_size_mb: number;
  // S3 direct stats
  s3_files?: number;
  s3_folders?: string[];
}

interface S3Folder {
  name: string;
  file_count: number;
  total_size: number;
}

// ============================================================================
// API Functions
// ============================================================================

const adminApi = {
  getTopics: () => api.get<Topic[]>('/admin/topics'),
  getTopic: (slug: string) => api.get<{ topic: Topic; resources: Resource[] }>(`/admin/topics/${slug}`),
  createTopic: (data: { name: string; description?: string }) => api.post<Topic>('/admin/topics', data),
  deleteTopic: (id: string) => api.delete(`/admin/topics/${id}`),
  uploadFile: (file: File, topicName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('topic_name', topicName);
    return api.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteResource: (id: string) => api.delete(`/admin/resources/${id}`),
  getStats: () => api.get<DashboardStats>('/admin/stats'),
  getS3Folders: () => api.get<{ folders: S3Folder[]; total_folders: number }>('/admin/s3/folders'),
};

// ============================================================================
// Utility Functions
// ============================================================================

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getFileIcon = (contentType: string | null): string => {
  if (!contentType) return '📄';
  if (contentType.includes('pdf')) return '📕';
  if (contentType.includes('word') || contentType.includes('document')) return '📘';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📗';
  if (contentType.includes('image')) return '🖼️';
  if (contentType.includes('video')) return '🎬';
  if (contentType.includes('audio')) return '🎵';
  if (contentType.includes('zip') || contentType.includes('rar')) return '📦';
  return '📄';
};

// ============================================================================
// Components
// ============================================================================

// Stats Card
const StatsCard = ({ icon: Icon, label, value, color }: {
  icon: typeof Folder;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  </div>
);

// Folder Card (Topic)
const FolderCard = ({ topic, onClick, onDelete }: {
  topic: Topic;
  onClick: () => void;
  onDelete: () => void;
}) => (
  <div
    className="group bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
          <Folder className="w-8 h-8 text-yellow-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {topic.name}
          </h3>
          <p className="text-sm text-gray-500">{topic.file_count} files</p>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
        title="Delete folder"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
    {topic.description && (
      <p className="mt-3 text-sm text-gray-500 line-clamp-2">{topic.description}</p>
    )}
  </div>
);

// File Row
const FileRow = ({ resource, onDelete }: {
  resource: Resource;
  onDelete: () => void;
}) => (
  <tr className="hover:bg-gray-50 group">
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{getFileIcon(resource.content_type)}</span>
        <div>
          <p className="font-medium text-gray-900">{resource.file_name}</p>
          <p className="text-xs text-gray-500">{resource.s3_key}</p>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 text-sm text-gray-500">
      {formatFileSize(resource.file_size)}
    </td>
    <td className="px-6 py-4 text-sm text-gray-500">
      {new Date(resource.created_at).toLocaleDateString('vi-VN')}
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={resource.s3_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
          title="Open file"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={resource.s3_url}
          download
          className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
          title="Delete file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
);

// Upload Modal
const UploadModal = ({ 
  isOpen, 
  onClose, 
  topics,
  onUpload 
}: {
  isOpen: boolean;
  onClose: () => void;
  topics: Topic[];
  onUpload: (file: File, topicName: string) => Promise<void>;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [topicName, setTopicName] = useState('');
  const [isNewTopic, setIsNewTopic] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !topicName.trim()) return;

    setUploading(true);
    try {
      await onUpload(file, topicName);
      onClose();
      setFile(null);
      setTopicName('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Upload File</h2>
        
        <form onSubmit={handleSubmit}>
          {/* File Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full border border-gray-300 rounded-lg p-2"
              required
            />
          </div>

          {/* Topic Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topic/Folder
            </label>
            
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!isNewTopic}
                  onChange={() => setIsNewTopic(false)}
                />
                <span className="text-sm">Existing Topic</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={isNewTopic}
                  onChange={() => setIsNewTopic(true)}
                />
                <span className="text-sm">New Topic</span>
              </label>
            </div>

            {isNewTopic ? (
              <input
                type="text"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="Enter new topic name (e.g., Toán Cao Cấp)"
                className="w-full border border-gray-300 rounded-lg p-2"
                required
              />
            ) : (
              <select
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2"
                required
              >
                <option value="">Select a topic...</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.name}>
                    {topic.name} ({topic.file_count} files)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !topicName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const AdminDashboard = () => {
  // State
  const [view, setView] = useState<'grid' | 'detail'>('grid');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [s3Folders, setS3Folders] = useState<S3Folder[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsRes, statsRes, s3FoldersRes] = await Promise.all([
        adminApi.getTopics(),
        adminApi.getStats(),
        adminApi.getS3Folders()
      ]);
      setTopics(topicsRes.data);
      setStats(statsRes.data);
      setS3Folders(s3FoldersRes.data.folders || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTopicDetail = async (slug: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getTopic(slug);
      setSelectedTopic(res.data.topic);
      setResources(res.data.resources);
      setView('detail');
    } catch (error) {
      console.error('Failed to load topic:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleUpload = async (file: File, topicName: string) => {
    await adminApi.uploadFile(file, topicName);
    loadData();
    if (selectedTopic) {
      loadTopicDetail(selectedTopic.slug);
    }
  };

  const handleDeleteTopic = async (topic: Topic) => {
    if (!confirm(`Delete folder "${topic.name}" and all ${topic.file_count} files?`)) return;
    try {
      await adminApi.deleteTopic(topic.id);
      loadData();
    } catch (error) {
      console.error('Failed to delete topic:', error);
    }
  };

  const handleDeleteResource = async (resource: Resource) => {
    if (!confirm(`Delete file "${resource.file_name}"?`)) return;
    try {
      await adminApi.deleteResource(resource.id);
      if (selectedTopic) {
        loadTopicDetail(selectedTopic.slug);
      }
      loadData();
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  };

  const handleBackToGrid = () => {
    setView('grid');
    setSelectedTopic(null);
    setResources([]);
  };

  // Merge DB topics with S3 folders for display
  const allFolders = React.useMemo(() => {
    const folderMap = new Map<string, Topic>();
    
    // Add DB topics first
    topics.forEach(t => {
      folderMap.set(t.slug, t);
    });
    
    // Add S3 folders that don't exist in DB
    s3Folders.forEach(f => {
      if (!folderMap.has(f.name)) {
        folderMap.set(f.name, {
          id: f.name, // Use folder name as ID for S3-only folders
          name: f.name,
          slug: f.name,
          description: `S3 folder with ${f.file_count} files`,
          file_count: f.file_count
        });
      } else {
        // Update file count from S3 if higher
        const existing = folderMap.get(f.name)!;
        if (f.file_count > existing.file_count) {
          folderMap.set(f.name, { ...existing, file_count: f.file_count });
        }
      }
    });
    
    return Array.from(folderMap.values());
  }, [topics, s3Folders]);

  // Filter folders
  const filteredFolders = allFolders.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.includes(searchQuery.toLowerCase())
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {view === 'detail' && (
                <button
                  onClick={handleBackToGrid}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">
                {view === 'grid' ? 'Knowledge Base' : selectedTopic?.name}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={loadData}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Upload Button */}
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === 'grid' ? (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatsCard
                  icon={Folder}
                  label="Total Folders"
                  value={stats.total_topics}
                  color="bg-yellow-500"
                />
                <StatsCard
                  icon={Files}
                  label="Total Files"
                  value={stats.total_resources}
                  color="bg-blue-500"
                />
                <StatsCard
                  icon={HardDrive}
                  label="Storage Used"
                  value={`${stats.total_size_mb} MB`}
                  color="bg-green-500"
                />
              </div>
            )}

            {/* Folders Grid */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Folders ({filteredFolders.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center py-20">
                <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No folders found</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Upload your first file
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFolders.map((topic) => (
                  <FolderCard
                    key={topic.id}
                    topic={topic}
                    onClick={() => loadTopicDetail(topic.slug)}
                    onDelete={() => handleDeleteTopic(topic)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Detail View */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Folder className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTopic?.name}</h2>
                    <p className="text-sm text-gray-500">{resources.length} files</p>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : resources.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No files in this folder</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resources.map((resource) => (
                    <FileRow
                      key={resource.id}
                      resource={resource}
                      onDelete={() => handleDeleteResource(resource)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        topics={allFolders}
        onUpload={handleUpload}
      />
    </div>
  );
};

export default AdminDashboard;
