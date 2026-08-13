import { useEffect } from 'react';
import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { WalletOutlined, BarChartOutlined, HistoryOutlined } from '@ant-design/icons';
import DebtManager from '../DebtManager';
import InterestStats from '../InterestStats';
import RepaymentHistory from '../RepaymentHistory';

export default function DebtCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = (() => {
    const path = location.pathname;
    if (path.endsWith('/interest')) return 'interest';
    if (path.endsWith('/history')) return 'history';
    return 'manage';
  })();

  // 根路径重定向
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/debt' || path === '/debt/manage') {
      navigate('/debt/manage', { replace: true });
    }
  }, []);

  const tabNavigate = (key: string) => {
    navigate(`/debt/${key}`);
  };

  return (
    <Tabs
      activeKey={activeTab}
      onChange={tabNavigate}
      items={[
        { key: 'manage', label: '债务管理', icon: <WalletOutlined />, children: <DebtManager /> },
        { key: 'history', label: '还款记录', icon: <HistoryOutlined />, children: <RepaymentHistory /> },
        { key: 'interest', label: '利息统计', icon: <BarChartOutlined />, children: <InterestStats /> },
      ]}
      destroyInactiveTabPane={false}
    />
  );
}