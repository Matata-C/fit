Component({
  properties: {
    pieData: {
      type: Array,
      value: []
    }
  },
  data: {
    canvasWidth: 220,
    canvasHeight: 220,
    colorList: [
      '#FFD600', // 可爱黄
      '#FFB6B9', // 粉
      '#A0E7E5', // 蓝绿
      '#B4F8C8', // 浅绿
      '#FFDAC1', // 橙
      '#FFFACD'  // 柠檬黄
    ]
  },
  observers: {
    'pieData': function (pieData) {
      this.drawPieChart();
    }
  },
  lifetimes: {
    attached() {
      this.drawPieChart();
    }
  },
  methods: {
    drawPieChart() {
      const query = this.createSelectorQuery();
      query.select('.exercise-pie-chart-canvas').fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;
        const width = this.data.canvasWidth;
        const height = this.data.canvasHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        // 处理数据
        const data = this.properties.pieData.map((item, idx) => ({
          ...item,
          color: item.color || this.data.colorList[idx % this.data.colorList.length]
        }));
        let total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return;
        let startAngle = -Math.PI / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 14;
        // 绘制饼图
        data.forEach((item, idx) => {
          const angle = (item.value / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle, false);
          ctx.closePath();
          ctx.fillStyle = item.color;
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          // 可爱分割线
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle, false);
          ctx.lineTo(centerX, centerY);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
          startAngle += angle;
        });
        // 中心icon
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFD600';
        ctx.fillText('🍰', centerX, centerY);
      });
    }
  }
}); 