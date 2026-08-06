import { useState } from 'react';
import { Tabs } from 'antd';
import { BarChartOutlined, UnorderedListOutlined, AppstoreOutlined, SwapOutlined } from '@ant-design/icons';
import PnlOverview from './PnlOverview';
import PnlRecords from './PnlRecords';
import PlatformManager from './PlatformManager';
import RateSettings from './RateSettings';
import PageHeader from '../Common/PageHeader';

type TabKey = 'overview' | 'records' | 'platforms' | 'rates';

export default function InvestLedger() {
  const [activeKey, setActiveKey] = useState<TabKey>('overview');

  return (
    <div>
      <PageHeader title="投资记账" subtitle="加密货币 / 美股 / 港股等盈亏记录与汇率管理" />
      <Tabs
        activeKey={activeKey}
        onChange={(k) => setActiveKey(k as TabKey)}
        items={[
          { key: 'overview', label: '盈亏总览', icon: <BarChartOutlined />, children: <PnlOverview onGotoRecords={() => setActiveKey('records')} /> },
          { key: 'records', label: '盈亏记录', icon: <UnorderedListOutlined />, children: <PnlRecords /> },
          { key: 'platforms', label: '平台管理', icon: <AppstoreOutlined />, children: <PlatformManager /> },
          { key: 'rates', label: '汇率设置', icon: <SwapOutlined />, children: <RateSettings /> },
        ]}
      />
    </div>
  );
}
