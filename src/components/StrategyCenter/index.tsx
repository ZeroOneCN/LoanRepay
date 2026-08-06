import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import PlanEngine from '../PlanEngine';
import DebtRestructure from '../DebtRestructure';

export default function StrategyCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.includes('/restructure') ? 'restructure' : 'plan';

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => navigate(key === 'restructure' ? '/strategy/restructure' : '/strategy/plan')}
      items={[
        { key: 'plan', label: '还款规划', children: <PlanEngine /> },
        { key: 'restructure', label: '债务重组', children: <DebtRestructure /> },
      ]}
      destroyInactiveTabPane={false}
    />
  );
}
