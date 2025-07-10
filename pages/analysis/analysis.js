// analysis.js
const weightUtil = require('../../utils/weightUtil');
const dateUtil = require('../../utils/dateUtil');
const tabBarManager = require('../../utils/tabBarManager');
const dataRepair = require('../../utils/dataRepair');
const app = getApp()

Page({
  data: {
    period: 'week', 
    hasData: false,
    weightData: [], 
    weightRecords: [],
    statistics: {
      totalLost: 0,
      avgSpeed: 0,
      daysToGoal: 0
    },
    chartOptions: {
      dateLabels: [],
      weightData: [],
      height: 200
    },
    isLoading: true, 
    isRepairing: false, 
    needRefresh: false 
  },

  onLoad() {
    console.log('分析页面加载');
    
    tabBarManager.initTabBarForPage(1);
    
    this.repairDataIfNeeded();
    
    try {
      this.preloadWeightRecords();
    } catch (e) {
      console.error('预加载体重记录失败:', e);
    }
  },

  repairDataIfNeeded() {
    this.setData({ isRepairing: true });
    
    try {
      const records = wx.getStorageSync('weightRecords');
      if (!Array.isArray(records)) {
        console.log('数据格式不正确，开始修复');
        wx.showLoading({
          title: '修复数据中...',
          mask: true
        });
        
        setTimeout(() => {
          try {
            const result = dataRepair.repairWeightRecords();
            
            if (result) {
              console.log('数据修复成功');
            } else {
              console.log('数据修复失败');
            }
            
            wx.hideLoading();
            this.setData({ isRepairing: false });
            this.loadWeightRecords();
          } catch (e) {
            console.error('修复过程出错:', e);
            wx.hideLoading();
            this.setData({ isRepairing: false });
          }
        }, 100);
      } else {
        console.log('数据格式正确，无需修复');
        this.setData({ isRepairing: false });
      }
    } catch (e) {
      console.error('检查数据格式出错:', e);
      this.setData({ isRepairing: false });
      try {
        dataRepair.repairWeightRecords();
      } catch (error) {
        console.error('强制修复失败:', error);
      }
    }
  },

  onShow() {
    console.log('分析页面显示');
    tabBarManager.setSelectedTab(1);
    try {
      const dataUpdated = wx.getStorageSync('dataUpdated');
      const lastUpdate = wx.getStorageSync('lastAnalysisUpdate') || 0;
      if ((dataUpdated && dataUpdated > lastUpdate) || this.data.needRefresh) {
        console.log('检测到数据更新，刷新分析页面数据');
        wx.setStorageSync('lastAnalysisUpdate', new Date().getTime());
        this.setData({ needRefresh: false, isLoading: true });
        this._weightRecords = null;
        setTimeout(() => {
          this.loadWeightRecords();
          setTimeout(() => {
            this.syncStatisticsWithUserStats();
          }, 100);
          
          console.log('数据已重新加载');
        }, 50);
        
        return; 
      }
    } catch (e) {
      console.error('检查数据更新失败:', e);
    }
    if (!this.data.isRepairing) {
      if (this.data.weightRecords && this.data.weightRecords.length > 0) {
        this.setData({ isLoading: false });
        this.syncStatisticsWithUserStats();
      } else {
        setTimeout(() => {
          this.loadWeightRecords();
          setTimeout(() => {
            this.syncStatisticsWithUserStats();
          }, 100);
        }, 50);
      }
    }
  },
  preloadWeightRecords() {
    try {
      let records = wx.getStorageSync('weightRecordsArray');
      if (!Array.isArray(records) || records.length === 0) {
        console.log('数组格式记录不存在，尝试读取对象格式记录');
        let objectRecords = wx.getStorageSync('weightRecords');
        if (typeof objectRecords === 'object' && objectRecords !== null) {
          const recordsArray = [];
          for (const key in objectRecords) {
            if (objectRecords.hasOwnProperty(key)) {
              recordsArray.push({
                date: key,
                weight: objectRecords[key]
              });
            }
          }
          records = recordsArray;
          console.log('已将对象格式转换为数组，长度:', records.length);
          if (records.length > 0) {
            wx.setStorageSync('weightRecordsArray', records);
          }
        } else {
          records = [];
          console.log('创建了空数组');
        }
      }
      records = records.filter(item => item && item.date && (item.weight !== undefined));
      if (Array.isArray(records) && records.length > 0) {
        try {
          records.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
          });
        } catch (sortError) {
          console.error('排序失败:', sortError);
        }
      }
      this._weightRecords = records;
      
      console.log('预加载完成，记录数量:', records.length);
    } catch (e) {
      console.error('预加载体重记录失败:', e);
      this._weightRecords = [];
    }
  },
  loadWeightRecords() {
    try {
      console.log('开始加载体重记录');
      this.setData({ isLoading: true });
      let records = wx.getStorageSync('weightRecordsArray');
      if (!Array.isArray(records) || records.length === 0) {
        console.log('数组格式记录不存在，尝试读取对象格式记录');
        let objectRecords = wx.getStorageSync('weightRecords');
        if (typeof objectRecords === 'object' && objectRecords !== null) {
          const recordsArray = [];
          for (const key in objectRecords) {
            if (objectRecords.hasOwnProperty(key)) {
              recordsArray.push({
                date: key,
                weight: objectRecords[key]
              });
            }
          }
          records = recordsArray;
          console.log('已将对象格式转换为数组，长度:', records.length);
          if (records.length > 0) {
            wx.setStorageSync('weightRecordsArray', records);
          }
        } else {
          records = [];
          console.log('创建了空数组');
        }
      }
      if (Array.isArray(records)) {
        if (records.length > 0) {
          this._weightRecords = records;
          this.setData({ 
            weightRecords: records,
            hasData: true,
            isLoading: false
          });
          const stats = this.calculateStatistics();
          
          if (stats) {
            this.setData({
              statistics: {
                totalLost: stats.totalLost,
                avgSpeed: (stats.avgSpeedPerWeek / 7).toFixed(2),
                daysToGoal: stats.daysToGo
              }
            });
          }
          this.updateChartData(this.data.period);
        } else {
          console.log('没有体重记录');
          this.setData({ 
            hasData: false,
            isLoading: false
          });
        }
      } else {
        console.log('无法获取有效的体重记录');
        this.setData({ 
          hasData: false,
          isLoading: false
        });
      }
    } catch (e) {
      console.error('加载体重记录失败:', e);
      this.setData({ 
        hasData: false,
        isLoading: false
      });
    }
  },
  updateChartData(period) {
    const records = this.data.weightRecords;
    if (!records || records.length === 0) {
      this.setData({ hasData: false });
      return;
    }
    
    try {
      const filteredRecords = this.filterRecordsByPeriod(records, period);
      
      if (filteredRecords.length === 0) {
        console.log('过滤后没有记录');
        this.setData({ hasData: false });
        return;
      }
      filteredRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      const dateLabels = [];
      const weightData = [];
      
      for (const record of filteredRecords) {
        if (record.date && record.weight !== undefined) {
          const formattedDate = dateUtil.formatDate ? 
            dateUtil.formatDate(record.date) : 
            record.date.substring(5);
          
          dateLabels.push(formattedDate);
          weightData.push(parseFloat(record.weight));
        }
      }
      
      if (weightData.length === 0) {
        console.log('没有有效的体重数据');
        this.setData({ hasData: false });
        return;
      }

      let minWeight = Math.min(...weightData);
      let maxWeight = Math.max(...weightData);

      minWeight = Math.max(0, minWeight - 0.5);
      maxWeight = maxWeight + 0.5;

      const normalizedWeights = weightData.map(weight => {
        if (maxWeight === minWeight) return 50; 
        return (100 - ((weight - minWeight) / (maxWeight - minWeight) * 100));
      });

      const statistics = this.calculateStatistics() || {
        totalLost: 0,
        avgSpeed: 0,
        daysToGo: 0
      };

      this.setData({
        chartOptions: {
          dateLabels: dateLabels,
          weightData: normalizedWeights,
          height: 200
        },
        weightData: weightData,
        hasData: true,
        statistics: {
          totalLost: statistics.totalLost || 0,
          avgSpeed: (statistics.avgSpeedPerWeek / 7).toFixed(2) || 0, 
          daysToGo: statistics.daysToGo || 0
        }
      });
      
      console.log('图表数据已更新，记录数:', dateLabels.length);
    } catch (e) {
      console.error('更新图表数据失败:', e);
      this.setData({ hasData: false });
    }
  },
  filterRecordsByPeriod(records, period) {
    if (!Array.isArray(records) || records.length === 0) return [];
    if (period === 'all') return records;
    
    try {
      const now = new Date();
      const cutoffDate = new Date();
      
      if (period === 'week') {
        cutoffDate.setDate(now.getDate() - 7); 
      } else if (period === 'month') {
        cutoffDate.setMonth(now.getMonth() - 1); 
      }
      
      return records.filter(item => {
        if (!item || !item.date) return false;
        
        const recordDate = new Date(item.date);
        if (isNaN(recordDate)) return false;
        
        return recordDate >= cutoffDate;
      });
    } catch (e) {
      console.error('筛选记录失败:', e);
      return [];
    }
  },
  calculateStatistics() {
    const records = this.data.weightRecords;
    if (!records || records.length === 0) {
      console.log('没有记录，无法计算统计数据');
      return null;
    }

    try {
      records.sort((a, b) => new Date(a.date) - new Date(b.date));
      if (records.length === 1) {
        const singleRecord = records[0];
        console.log('只有单条记录，创建初始统计数据');
        
        const statistics = {
          totalRecords: 1,
          firstDate: singleRecord.date,
          latestDate: singleRecord.date,
          firstWeight: singleRecord.weight,
          latestWeight: singleRecord.weight,
          totalLost: 0,
          avgSpeedPerWeek: 0,
          daysElapsed: 0,
          daysToGo: 0
        };
        wx.setStorageSync('analysisStatistics', statistics);
        this.syncStatisticsWithUserStats(statistics, singleRecord.weight);
        
        return statistics;
      }
      const firstRecord = records[0];
      const latestRecord = records[records.length - 1];
      const totalLost = (parseFloat(firstRecord.weight) - parseFloat(latestRecord.weight)).toFixed(1);
      const daysDiff = Math.round((new Date(latestRecord.date) - new Date(firstRecord.date)) / (24 * 60 * 60 * 1000));

      const avgSpeedPerWeek = daysDiff > 0 ? ((totalLost / daysDiff) * 7).toFixed(2) : 0;

      let daysToGo = 0;
      const goalData = wx.getStorageSync('goalData');
      if (goalData && goalData.goalWeight) {
        const weightToGo = parseFloat(latestRecord.weight) - parseFloat(goalData.goalWeight);
        if (weightToGo > 0 && avgSpeedPerWeek > 0) {
          daysToGo = Math.ceil((weightToGo / avgSpeedPerWeek) * 7);
        }
      }

      const statistics = {
        totalRecords: records.length,
        firstDate: firstRecord.date,
        latestDate: latestRecord.date,
        firstWeight: firstRecord.weight,
        latestWeight: latestRecord.weight,
        totalLost: totalLost,
        avgSpeedPerWeek: avgSpeedPerWeek,
        daysElapsed: daysDiff,
        daysToGo: daysToGo
      };

      wx.setStorageSync('analysisStatistics', statistics);

      this.syncStatisticsWithUserStats(statistics, latestRecord.weight);
      
      console.log('统计数据计算完成:', statistics);
      return statistics;
    } catch (e) {
      console.error('计算统计数据失败:', e);
      return null;
    }
  },
  syncStatisticsWithUserStats(statistics, currentWeight) {
    try {
      if (!statistics) {
        console.log('统计数据为空，无法同步到用户统计');
        return;
      }

      let userStats = wx.getStorageSync('userStats') || {};

      if (statistics.totalLost !== undefined) {
        userStats.totalWeightLoss = parseFloat(statistics.totalLost);
      }
      
      if (currentWeight !== undefined) {
        userStats.currentWeight = parseFloat(currentWeight);
      }

      const goalData = wx.getStorageSync('goalData');
      if (goalData && goalData.goalWeight && userStats.currentWeight) {
        const startWeight = parseFloat(userStats.startWeight || goalData.startWeight || userStats.currentWeight);
        const goalWeight = parseFloat(goalData.goalWeight);
        const currentWeight = parseFloat(userStats.currentWeight);

        const totalToLose = startWeight - goalWeight;
        const alreadyLost = Math.max(0, startWeight - currentWeight);

        userStats.weightLossPercentage = totalToLose > 0 
          ? Math.min(100, Math.round((alreadyLost / totalToLose) * 100)) 
          : 0;

        userStats.weightToGo = Math.max(0, currentWeight - goalWeight).toFixed(1);
      }
      wx.setStorageSync('userStats', userStats);
      console.log('用户统计数据已更新:', userStats);
    } catch (e) {
      console.error('同步用户统计数据失败:', e);
    }
  },

  switchPeriod(e) {
    const period = e.currentTarget.dataset.period;
    this.setData({ period });
    this.updateChartData(period);
  },
}) 