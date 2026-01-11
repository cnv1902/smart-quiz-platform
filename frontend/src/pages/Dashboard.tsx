import { useEffect, useState } from 'react';
import { FileText, Users, BarChart3, TrendingUp, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardAPI } from '../services/api';
import { DashboardData } from '../types';

type Period = 'day' | 'week' | 'month' | 'year';

export const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('day');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    try {
      const response = await dashboardAPI.getData(period);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodLabels = {
    day: 'Hôm nay',
    week: 'Tuần này',
    month: 'Tháng này',
    year: 'Năm nay'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Tổng đề thi',
      value: data?.stats.total_exams || 0,
      icon: FileText,
      color: 'text-primary-500',
      bgColor: 'bg-primary-50',
    },
    {
      label: 'Tổng lớp học',
      value: data?.stats.total_classes || 0,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Tổng học sinh',
      value: data?.stats.total_students || 0,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Lượt làm bài',
      value: data?.stats.total_attempts || 0,
      icon: BarChart3,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Tổng quan hoạt động của bạn</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        {stats.map((stat, index) => (
          <div 
            key={index} 
            className="card hover:shadow-lift transition-all duration-200 p-3 lg:p-4"
          >
            <div className="flex items-center gap-3 lg:gap-4">
              <div className={`p-2 lg:p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={stat.color} size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm text-slate-500 truncate">{stat.label}</p>
                <p className="text-lg lg:text-2xl font-bold text-slate-800">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Traffic Chart */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base lg:text-lg font-semibold text-slate-800">Lượng truy cập</h2>
            <p className="text-xs lg:text-sm text-slate-500">Số lượt làm bài thi của bạn</p>
          </div>
          
          {/* Period Selector */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span>{periodLabels[period]}</span>
              <ChevronDown size={16} className="text-slate-500" />
            </button>
            
            {showPeriodDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowPeriodDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                  {(Object.keys(periodLabels) as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPeriod(p);
                        setShowPeriodDropdown(false);
                        setLoading(true);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors
                        ${period === p ? 'text-primary-500 font-medium' : 'text-slate-700'}`}
                    >
                      {periodLabels[p]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-60 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.traffic_24h || []}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="hour" 
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ color: '#334155', fontWeight: 600 }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#0EA5E9" 
                strokeWidth={2}
                fill="url(#colorCount)"
                name="Lượt truy cập"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
