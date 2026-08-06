import { useMemo } from 'react';
import { Row, Col, Button, Empty, Tag, Space } from 'antd';
import { RiseOutlined, FallOutlined, DollarOutlined, PlusOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { INVEST_MARKET_LABELS, InvestMarket, Currency, ProductType, PRODUCT_TYPE_LABELS } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

export default function PnlOverview({ onGotoRecords }: { onGotoRecords: () => void }) {
  const { pnlRecords, platforms, accounts, fxRates, convertToCNY } = useApp();

  const stats = useMemo(() => {
    const byCurrency: Record<Currency, number> = { CNY: 0, USD: 0, HKD: 0, USDT: 0 };
    pnlRecords.forEach(r => { byCurrency[r.currency] += r.pnl; });
    const totalCNY = pnlRecords.reduce((sum, r) => sum + convertToCNY(r.pnl, r.currency), 0);
    const profitCNY = pnlRecords.filter(r => r.pnl > 0).reduce((sum, r) => sum + convertToCNY(r.pnl, r.currency), 0);
    const lossCNY = pnlRecords.filter(r => r.pnl < 0).reduce((sum, r) => sum + convertToCNY(r.pnl, r.currency), 0);
    return { byCurrency, totalCNY, profitCNY, lossCNY };
  }, [pnlRecords, fxRates]);

  // 按账户汇总（CNY 口径），同时包含所属平台
  const byAccount = useMemo(() => {
    const map = new Map<string, { name: string; platformName: string; markets: InvestMarket[]; productTypes?: ProductType[]; pnlCNY: number; recordCount: number }>();
    pnlRecords.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
      const key = acc?.id || r.platformId || 'unknown';
      const accName = acc?.name || (pf ? `${pf.name}（旧数据）` : '未知账户');
      // 兼容老的单值 market / productType 字段
      let mkts = pf?.markets;
      if (!mkts && (pf as any)?.market) mkts = [(pf as any).market];
      let pts = acc?.productTypes;
      if (!pts && (acc as any)?.productType) pts = [(acc as any).productType];
      const existing = map.get(key) || { name: accName, platformName: pf?.name || '未知', markets: Array.isArray(mkts) && mkts.length > 0 ? mkts : ['other'], productTypes: pts, pnlCNY: 0, recordCount: 0 };
      existing.pnlCNY += convertToCNY(r.pnl, r.currency);
      existing.recordCount += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.pnlCNY - a.pnlCNY);
  }, [pnlRecords, platforms, accounts, fxRates]);

  // 按平台汇总
  const byPlatform = useMemo(() => {
    const map = new Map<string, { name: string; pnlCNY: number }>();
    pnlRecords.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
      const pid = pf?.id || r.platformId || 'unknown';
      const name = pf?.name || '未知平台';
      const existing = map.get(pid) || { name, pnlCNY: 0 };
      existing.pnlCNY += convertToCNY(r.pnl, r.currency);
      map.set(pid, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.pnlCNY - a.pnlCNY);
  }, [pnlRecords, platforms, accounts, fxRates]);

  // 按市场汇总：平台可多市场，记录计入其所属平台的全部市场（市场敞口口径）
  const byMarket = useMemo(() => {
    const map = new Map<InvestMarket, number>();
    pnlRecords.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
      let mkts = pf?.markets;
      if (!mkts && (pf as any)?.market) mkts = [(pf as any).market];
      const arr: InvestMarket[] = Array.isArray(mkts) && mkts.length > 0 ? mkts : ['other'];
      const cnyVal = convertToCNY(r.pnl, r.currency);
      arr.forEach(m => map.set(m, (map.get(m) || 0) + cnyVal));
    });
    return Array.from(map.entries()).map(([market, value]) => ({ market, value }));
  }, [pnlRecords, platforms, accounts, fxRates]);

  // 多市场下记录会重复计入多个市场，改用条形图展示市场敞口，避免饼图占比失真
  const marketBarOption = useMemo(() => {
    if (byMarket.length === 0) return {};
    const colorMap: Record<InvestMarket, string> = {
      crypto: COLORS.orange, us_stock: COLORS.primary, hk_stock: COLORS.purple, a_stock: COLORS.danger, other: COLORS.textTertiary
    };
    const sorted = [...byMarket].sort((a, b) => b.value - a.value);
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>${p[0].marker}¥${formatMoney(p[0].value)}` },
      grid: { left: '3%', right: '6%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toFixed(0) } },
      yAxis: {
        type: 'category',
        data: sorted.map(d => INVEST_MARKET_LABELS[d.market]),
        axisLabel: { fontSize: 12 }
      },
      series: [{
        type: 'bar',
        data: sorted.map(d => ({
          value: Number(d.value.toFixed(2)),
          itemStyle: { color: d.value >= 0 ? colorMap[d.market] : COLORS.danger }
        })),
        barWidth: '50%',
        label: { show: true, position: 'right', fontSize: 11, formatter: (p: any) => `¥${formatMoney(p.value)}` }
      }]
    };
  }, [byMarket]);

  const platformBarOption = useMemo(() => {
    if (byPlatform.length === 0) return {};
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>${p[0].marker}¥${formatMoney(p[0].value)}` },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: byPlatform.map(p => p.name),
        axisLabel: { fontSize: 11, interval: 0, rotate: byPlatform.length > 4 ? 30 : 0 }
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toFixed(0) } },
      series: [{
        type: 'bar',
        data: byPlatform.map(p => ({
          value: Number(p.pnlCNY.toFixed(2)),
          itemStyle: { color: p.pnlCNY >= 0 ? COLORS.success : COLORS.danger }
        }))
      }]
    };
  }, [byPlatform]);

  if (pnlRecords.length === 0) {
    return (
      <EmptyState
        description="暂无盈亏记录，请先在「平台管理」添加平台和账户，再到「盈亏记录」录入数据"
        actionText="去录入盈亏"
        onAction={onGotoRecords}
      />
    );
  }

  const missingRates = (Object.keys(stats.byCurrency) as Currency[]).filter(
    c => c !== 'CNY' && stats.byCurrency[c] !== 0 && !fxRates.find(r => r.from === c)
  );

  return (
    <div>
      {missingRates.length > 0 && (
        <div style={{
          marginBottom: SPACING.lg, padding: SPACING.md,
          background: COLORS.bgWarningLight, borderRadius: 6,
          fontSize: FONT.bodySmall, color: COLORS.warning
        }}>
          提示：检测到 {missingRates.join('、')} 币种的盈亏，但未设置对应汇率，折算 CNY 时按原值计算。请到「汇率设置」补全。
        </div>
      )}

      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计总盈亏（CNY）" value={stats.totalCNY} precision={2} prefix={stats.totalCNY >= 0 ? <RiseOutlined /> : <FallOutlined />} suffix="元" color={stats.totalCNY >= 0 ? COLORS.success : COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计盈利（CNY）" value={stats.profitCNY} precision={2} prefix={<RiseOutlined />} suffix="元" color={COLORS.success} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计亏损（CNY）" value={stats.lossCNY} precision={2} prefix={<FallOutlined />} suffix="元" color={COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="盈亏记录数" value={pnlRecords.length} prefix={<DollarOutlined />} suffix="条" color={COLORS.primary} />
        </Col>
      </Row>

      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <SectionCard title="各平台盈亏（CNY 折算）">
            {byPlatform.length > 0 ? (
              <ReactECharts option={platformBarOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <Empty description="暂无平台数据" />
            )}
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="各市场盈亏（CNY 敞口）" extra={<span style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>多市场平台按各市场计入</span>}>
            {byMarket.length > 0 ? (
              <ReactECharts option={marketBarOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <Empty description="暂无市场数据" />
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* 按账户明细 */}
      <SectionCard
        title="各账户明细（CNY 折算）"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={onGotoRecords}>录入盈亏</Button>}
        style={{ marginBottom: SPACING.lg }}
      >
        {byAccount.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: SPACING.lg
          }}>
            {byAccount.map(a => (
              <div key={a.name + a.platformName} style={{
                padding: SPACING.lg, borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bgLight
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm }}>
                  <div style={{ fontWeight: 500, fontSize: FONT.h3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <Space size={4} wrap>
                    {a.markets.map(m => (
                      <Tag key={m} style={{ fontSize: FONT.caption, marginRight: 0 }}>{INVEST_MARKET_LABELS[m]}</Tag>
                    ))}
                  </Space>
                </div>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
                  {a.platformName}
                  {a.productTypes && a.productTypes.length > 0 && a.productTypes.map(pt => (
                    <Tag key={pt} color={pt === 'spot' ? 'green' : 'magenta'} style={{ marginLeft: 6 }}>
                      {PRODUCT_TYPE_LABELS[pt]}
                    </Tag>
                  ))}
                  <span style={{ marginLeft: 6 }}>· {a.recordCount} 条记录</span>
                </div>
                <div style={{
                  fontSize: FONT.h2, fontWeight: 600,
                  color: a.pnlCNY >= 0 ? COLORS.success : COLORS.danger
                }}>
                  {a.pnlCNY >= 0 ? '+' : ''}¥{formatMoney(a.pnlCNY)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无账户数据" />
        )}
      </SectionCard>

      <SectionCard title="各币种原值明细">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.lg }}>
          {(Object.keys(stats.byCurrency) as Currency[]).map(c => (
            <div key={c} style={{ minWidth: 140, padding: SPACING.md, background: COLORS.bgLight, borderRadius: 6 }}>
              <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{c}</div>
              <div style={{ fontSize: FONT.h2, fontWeight: 600, color: stats.byCurrency[c] >= 0 ? COLORS.success : COLORS.danger }}>
                {stats.byCurrency[c] >= 0 ? '+' : ''}{formatMoney(stats.byCurrency[c])}
              </div>
              {c !== 'CNY' && (
                <div style={{ fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 4 }}>
                  ≈ ¥{formatMoney(convertToCNY(stats.byCurrency[c], c))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
