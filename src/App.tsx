import { useState } from 'react';
import { Layout, Menu, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  WalletOutlined,
  BankOutlined,
  MoneyCollectOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';
import { AppProvider } from './context/AppContext';
import Dashboard from './components/Dashboard';
import DebtManager from './components/DebtManager';
import AssetManager from './components/AssetManager';
import IncomeManager from './components/IncomeManager';
import PlanEngine from './components/PlanEngine';
import DebtRestructure from './components/DebtRestructure';
import { COLORS, FONT, FONT_WEIGHT, SPACING } from './styles/theme';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type MenuKey = 'dashboard' | 'debt' | 'asset' | 'income' | 'plan' | 'restructure';

const MENU_ITEMS = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '财务总览' },
  { key: 'debt', icon: <WalletOutlined />, label: '债务管理' },
  { key: 'asset', icon: <BankOutlined />, label: '资产管理' },
  { key: 'income', icon: <MoneyCollectOutlined />, label: '收入支出' },
  { key: 'plan', icon: <ThunderboltOutlined />, label: '还款规划' },
  { key: 'restructure', icon: <SwapOutlined />, label: '债务重组' },
];

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState<MenuKey>(() => {
    const saved = localStorage.getItem('active_page');
    if (saved && MENU_ITEMS.some(m => m.key === saved)) {
      return saved as MenuKey;
    }
    return 'dashboard';
  });

  const handleMenuClick = (key: MenuKey) => {
    setActiveKey(key);
    localStorage.setItem('active_page', key);
  };

  const renderContent = () => {
    switch (activeKey) {
      case 'dashboard': return <Dashboard />;
      case 'debt': return <DebtManager />;
      case 'asset': return <AssetManager />;
      case 'income': return <IncomeManager />;
      case 'plan': return <PlanEngine />;
      case 'restructure': return <DebtRestructure />;
      default: return <Dashboard />;
    }
  };

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
        {/* Logo 区域 */}
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
          onClick={({ key }) => handleMenuClick(key as MenuKey)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        {/* 顶栏 */}
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
              <MenuUnfoldOutlined
                onClick={() => setCollapsed(false)}
                style={{ fontSize: 18, cursor: 'pointer', color: COLORS.textSecondary }}
              />
            ) : (
              <MenuFoldOutlined
                onClick={() => setCollapsed(true)}
                style={{ fontSize: 18, cursor: 'pointer', color: COLORS.textSecondary }}
              />
            )}
            <Text style={{ fontSize: FONT.h2, fontWeight: FONT_WEIGHT.semiBold, color: COLORS.textPrimary, margin: 0 }}>
              {currentLabel}
            </Text>
          </div>
          <Text style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>
            还款管家
          </Text>
        </Header>
        {/* 内容区 */}
        <Content style={{
          padding: SPACING.xl,
          flex: 1,
          overflowY: 'auto',
          background: COLORS.bgPage,
        }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
