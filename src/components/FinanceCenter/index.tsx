import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import AssetManager from '../AssetManager';
import IncomeManager from '../IncomeManager';

export default function FinanceCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.includes('/income') ? 'income' : 'asset';

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => navigate(key === 'income' ? '/finance/income' : '/finance/asset')}
      items={[
        { key: 'asset', label: '资产管理', children: <AssetManager /> },
        { key: 'income', label: '收入支出', children: <IncomeManager /> },
      ]}
      destroyInactiveTabPane={false}
    />
  );
}
