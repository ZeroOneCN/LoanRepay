import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Space } from 'antd';
import {
  DashboardOutlined,
  WalletOutlined,
  BankOutlined,
  ThunderboltOutlined,
  FundOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';
import { AppProvider } from './context/AppContext';
import Dashboard from './components/Dashboard';
import DebtCenter from './components/DebtCenter';
import FinanceCenter from './components/FinanceCenter';
import StrategyCenter from './components/StrategyCenter';
import InvestLedger from './components/InvestLedger';
import { COLORS, FONT, FONT_WEIGHT, SPACING } from './styles/theme';

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '财务总览' },
  { key: '/debt', icon: <WalletOutlined />, label: '债务中心' },
  { key: '/finance', icon: <BankOutlined />, label: '资产负债' },
  { key: '/invest', icon: <FundOutlined />, label: '投资记账' },
  { key: '/strategy', icon: <ThunderboltOutlined />, label: '还款策略' },
];

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const activeKey = (() => {
    const path = location.pathname;
    const topRoute = '/' + path.split('/')[1];
    return MENU_ITEMS.some(m => m.key === topRoute) ? topRoute : '/dashboard';
  })();

  const currentLabel = MENU_ITEMS.find(m => m.key === activeKey)?.label || '';

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{ height: '100vh', overflowY: 'auto', borderRight: `1px solid ${COLORS.border}` }}
      >
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          {collapsed ? (
            <ThunderboltOutlined style={{ fontSize: 22, color: COLORS.primary }} />
          ) : (
            <Space>
              <ThunderboltOutlined style={{ fontSize: 20, color: COLORS.primary }} />
              <span style={{ fontSize: FONT.h2, fontWeight: FONT_WEIGHT.semiBold, color: COLORS.primary }}>还款管家</span>
            </Space>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        <Header style={{
          padding: `0 ${SPACING.xl}px`,
          background: COLORS.bgCard,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          height: 56,
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
            {collapsed ? (
              <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer', color: COLORS.textSecondary }} />
            ) : (
              <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ fontSize: 18, cursor: 'pointer', color: COLORS.textSecondary }} />
            )}
            <span style={{ fontSize: FONT.h2, fontWeight: FONT_WEIGHT.semiBold, color: COLORS.textPrimary, margin: 0 }}>
              {currentLabel}
            </span>
            <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary, marginLeft: SPACING.sm }}>
              {location.pathname}
            </span>
          </div>
          <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>还款管家</span>
        </Header>
        <Content style={{
          padding: SPACING.xl,
          flex: 1,
          overflowY: 'auto',
          background: COLORS.bgPage,
        }}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/debt/*" element={<DebtCenter />} />
            <Route path="/finance/*" element={<FinanceCenter />} />
            <Route path="/invest/*" element={<InvestLedger />} />
            <Route path="/strategy/*" element={<StrategyCenter />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
