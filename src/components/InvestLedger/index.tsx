import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Select, Tooltip, Badge } from 'antd';
import { BarChartOutlined, UnorderedListOutlined, AppstoreOutlined, SwapOutlined, FundOutlined, FileTextOutlined } from '@ant-design/icons';
import PnlOverview from './PnlOverview';
import PnlRecords from './PnlRecords';
import PlatformManager from './PlatformManager';
import RateSettings from './RateSettings';
import InvestMemoPage from './InvestMemoPage';
import PageHeader from '../Common/PageHeader';
import { useApp } from '../../context/AppContext';
import { Currency } from '../../types';
import { COLORS, SPACING } from '../../styles/theme';

const { Option } = Select;

type TabKey = 'overview' | 'records' | 'platforms' | 'rates' | 'memo';

const DISPLAY_CURRENCIES: Currency[] = ['CNY', 'USD', 'HKD', 'USDT'];

export default function InvestLedger() {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayCurrency, setDisplayCurrency, fxRates, memos } = useApp();

  // 从 URL 推断当前 Tab
  const activeKey: TabKey = (() => {
    const path = location.pathname;
    if (path.endsWith('/records')) return 'records';
    if (path.endsWith('/platforms')) return 'platforms';
    if (path.endsWith('/rates')) return 'rates';
    if (path.endsWith('/memo')) return 'memo';
    return 'overview';
  })();

  // 根路径重定向到 overview
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/invest' || path === '') {
      navigate('/invest/overview', { replace: true });
    }
  }, []);

  // 缺失汇率提示
  const missingForDisplay = displayCurrency !== 'CNY' && !fxRates.find(r => r.from === displayCurrency);

  const pendingMemoCount = memos.filter(m => m.status === 'pending').length;

  return (
    <div>
      <PageHeader
        title="投资记账"
        subtitle="加密货币 / 美股 / 港股等盈亏记录与汇率管理"
        extra={
          <Tooltip
            title={
              missingForDisplay
                ? `未设置 ${displayCurrency} 汇率，折算可能不准，请先到「汇率设置」配置`
                : '切换盈亏/统计的展示币种，切换后页面自动重算所有数值'
            }
          >
            <Select
              value={displayCurrency}
              onChange={(v) => setDisplayCurrency(v)}
              style={{ width: 160 }}
              status={missingForDisplay ? 'warning' : undefined}
              suffixIcon={<FundOutlined />}
            >
              {DISPLAY_CURRENCIES.map(c => (
                <Option key={c} value={c}>
                  <span style={{ color: missingForDisplay && c === displayCurrency ? COLORS.warning : COLORS.textPrimary }}>
                    显示币种：{c}
                  </span>
                </Option>
              ))}
            </Select>
          </Tooltip>
        }
      />
      <Tabs
        activeKey={activeKey}
        onChange={(k) => navigate(`/invest/${k}`)}
        style={{ marginTop: SPACING.lg }}
        items={[
          { key: 'overview', label: '盈亏总览', icon: <BarChartOutlined />, children: <PnlOverview onGotoRecords={() => navigate('/invest/records')} /> },
          { key: 'records', label: '盈亏记录', icon: <UnorderedListOutlined />, children: <PnlRecords /> },
          { key: 'platforms', label: '平台管理', icon: <AppstoreOutlined />, children: <PlatformManager /> },
          { key: 'rates', label: '汇率设置', icon: <SwapOutlined />, children: <RateSettings /> },
          {
            key: 'memo',
            label: (
              <Badge count={pendingMemoCount} size="small" offset={[6, -2]}>
                <span><FileTextOutlined style={{ marginRight: 4 }} />备忘录</span>
              </Badge>
            ),
            children: <InvestMemoPage />
          },
        ]}
      />
    </div>
  );
}
