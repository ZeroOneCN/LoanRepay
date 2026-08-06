import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import DebtManager from '../DebtManager';
import InterestStats from '../InterestStats';

export default function DebtCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.includes('/interest') ? 'interest' : 'manage';

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => navigate(key === 'interest' ? '/debt/interest' : '/debt/manage')}
      items={[
        { key: 'manage', label: '债务管理', children: <DebtManager /> },
        { key: 'interest', label: '利息统计', children: <InterestStats /> },
      ]}
      destroyInactiveTabPane={false}
    />
  );
}
