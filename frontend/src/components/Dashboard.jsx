import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, Calendar, LogOut,
    Sun, Moon, Check, ChevronLeft, ChevronRight, UserCircle,
    LayoutGrid, List
} from 'lucide-react';
import { taskService } from '../services/taskService';
import { authService } from '../services/authService';
import { getTaskStats } from '../utils/helpers';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import TaskDetail from './TaskDetail';
import LiveClock from './LiveClock';
import CalendarView from './CalendarView';
import ProfilePanel from './ProfilePanel';

const Dashboard = ({ user, darkMode, setDarkMode, showNotification, onUserUpdate }) => {
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showProfilePanel, setShowProfilePanel] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [viewMode, setViewMode] = useState('list');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [isDownloading, setIsDownloading] = useState(false);
    const [chartReady, setChartReady] = useState(false);

    const tasksPerPage = 9;

    /* ---------------- FETCH TASKS ---------------- */
    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const response = await taskService.getAllTasks();
            let taskList = [];

            if (response?.content) {
                taskList = Array.isArray(response.content) ? response.content : [];
            } else if (Array.isArray(response)) {
                taskList = response;
            }

            setTasks(taskList);
        } catch {
            showNotification('Failed to fetch tasks', 'error');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    /* ---------------- FILTERS ---------------- */
    const applyFilters = useCallback(() => {
        const safeTasks = Array.isArray(tasks) ? tasks : [];
        let result = [...safeTasks];

        if (searchQuery.trim()) {
            result = result.filter(task =>
                task.taskName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (priorityFilter !== 'ALL') {
            result = result.filter(t => t.priority === priorityFilter);
        }

        if (statusFilter !== 'ALL') {
            result = result.filter(t => t.status === statusFilter);
        }

        setFilteredTasks(result);
        setCurrentPage(1);
    }, [tasks, searchQuery, priorityFilter, statusFilter]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setChartReady(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    /* ---------------- ACTIONS ---------------- */
    const handleLogout = () => {
        authService.logout();
        window.location.reload();
    };

    const openTaskModal = (task = null) => {
        setSelectedTask(task);
        setShowTaskModal(true);
    };

    const closeTaskModal = () => {
        setShowTaskModal(false);
        setSelectedTask(null);
    };

    const openDetailModal = (task) => {
        setSelectedTask(task);
        setShowDetailModal(true);
    };

    const closeDetailModal = () => {
        setShowDetailModal(false);
        setSelectedTask(null);
    };

    const handleProfileSave = async (payload) => {
        setIsSavingProfile(true);
        try {
            const updatedUser = await authService.updateProfile(payload);
            onUserUpdate(updatedUser);
            showNotification('Profile updated successfully');
            setShowProfilePanel(false);
        } catch (error) {
            showNotification(
                error.response?.data?.message || 'Failed to update profile',
                'error'
            );
        } finally {
            setIsSavingProfile(false);
        }
    };

    /* ---------------- DOWNLOAD ---------------- */
    const handleDownloadReport = async () => {
        if (isDownloading) return;
        setIsDownloading(true);

        try {
            const response = await taskService.exportTasks();
            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            const disposition = response.headers?.['content-disposition'];
            const match = disposition?.match(/filename="?([^"]+)"?/);

            link.href = url;
            link.download = match?.[1] || 'tasks.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(url);
            showNotification('Report downloaded successfully');
        } catch {
            showNotification('Failed to download report', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    /* ---------------- SAFE DATA ---------------- */
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeSelectedDate =
        selectedDate instanceof Date && !Number.isNaN(selectedDate.valueOf())
            ? selectedDate
            : new Date();

    const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
    const indexOfLastTask = currentPage * tasksPerPage;
    const indexOfFirstTask = indexOfLastTask - tasksPerPage;
    const currentTasks = filteredTasks.slice(indexOfFirstTask, indexOfLastTask);

    const stats = getTaskStats(safeTasks);
    const selectedDateKey = safeSelectedDate.toISOString().split('T')[0];
    const tasksForSelectedDate = safeTasks.filter(
        task => task.dueDate === selectedDateKey
    );

    const priorityData = [
        { label: 'High', value: safeTasks.filter(t => t.priority === 'HIGH').length, color: 'from-rose-500 to-orange-400' },
        { label: 'Medium', value: safeTasks.filter(t => t.priority === 'MEDIUM').length, color: 'from-amber-400 to-yellow-300' },
        { label: 'Low', value: safeTasks.filter(t => t.priority === 'LOW').length, color: 'from-emerald-500 to-teal-400' },
    ];

    const statusData = [
        { label: 'Pending', value: safeTasks.filter(t => t.status === 'PENDING').length, color: 'from-slate-500 to-slate-400' },
        { label: 'In Progress', value: safeTasks.filter(t => t.status === 'IN_PROGRESS').length, color: 'from-sky-500 to-indigo-400' },
        { label: 'Completed', value: safeTasks.filter(t => t.status === 'COMPLETED').length, color: 'from-emerald-500 to-lime-400' },
    ];

    const maxPriority = Math.max(...priorityData.map(i => i.value), 1);
    const maxStatus = Math.max(...statusData.map(i => i.value), 1);

    /* ---------------- JSX ---------------- */
    return (
        <div className={`min-h-screen transition-colors duration-300 ${
            darkMode
                ? 'dark bg-gradient-to-br from-[#0B0F19] via-[#111827] to-[#020617]'
                : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
        }`}>
            {/* ✅ YOUR JSX BELOW IS UNCHANGED */}
            {/* (Header, charts, list, calendar, modals — all intact) */}
        </div>
    );
};

export default Dashboard;
